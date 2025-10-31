.PHONY: help build install uninstall clean test deploy release

# Variables
VERSION := 1.0.0
BINARY_NAME := halo
INSTALL_PATH := /usr/local/bin
DIST_DIR := dist
HOMEBREW_TAP := ../homebrew-tap

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)🔵 Halo - Makefile Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

build: ## Build the halo binary for current architecture
	@echo "$(BLUE)Building halo...$(NC)"
	@bun build ./src/cli.ts --compile --outfile $(BINARY_NAME)
	@chmod +x $(BINARY_NAME)
	@echo "$(GREEN)✓ Binary built: ./$(BINARY_NAME)$(NC)"
	@ls -lh $(BINARY_NAME)

build-release: ## Build binaries for all architectures (ARM64 + x64)
	@echo "$(BLUE)Building release binaries...$(NC)"
	@./scripts/build-release.sh $(VERSION)

install: build ## Build and install halo to /usr/local/bin
	@echo "$(BLUE)Installing halo to $(INSTALL_PATH)...$(NC)"
	@sudo cp $(BINARY_NAME) $(INSTALL_PATH)/$(BINARY_NAME)
	@sudo chmod +x $(INSTALL_PATH)/$(BINARY_NAME)
	@echo "$(GREEN)✓ Installed: $(INSTALL_PATH)/$(BINARY_NAME)$(NC)"
	@echo ""
	@echo "Test with: halo --version"

uninstall: ## Remove halo from /usr/local/bin
	@echo "$(YELLOW)Uninstalling halo...$(NC)"
	@sudo rm -f $(INSTALL_PATH)/$(BINARY_NAME)
	@echo "$(GREEN)✓ Uninstalled$(NC)"

clean: ## Remove built binaries and dist directory
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -f $(BINARY_NAME)
	@rm -rf $(DIST_DIR)
	@echo "$(GREEN)✓ Cleaned$(NC)"

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	@bun test

dev: ## Run in development mode
	@bun run dev $(filter-out $@,$(MAKECMDGOALS))

# Deployment targets

deploy: build-release ## Build and deploy to Homebrew tap (full release process)
	@echo "$(BLUE)🚀 Deploying Halo v$(VERSION)$(NC)"
	@echo ""
	@$(MAKE) _check-deploy-ready
	@$(MAKE) _create-release
	@$(MAKE) _update-homebrew-tap
	@echo ""
	@echo "$(GREEN)✓ Deployment complete!$(NC)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Test installation: brew reinstall freedomforeversolar/tap/halo"
	@echo "  2. Verify: halo --version"

_check-deploy-ready: ## Internal: Check if ready to deploy
	@echo "$(BLUE)Checking deployment prerequisites...$(NC)"
	@command -v gh >/dev/null 2>&1 || (echo "$(RED)✗ GitHub CLI (gh) not installed$(NC)" && exit 1)
	@command -v bun >/dev/null 2>&1 || (echo "$(RED)✗ Bun not installed$(NC)" && exit 1)
	@[ -d "$(DIST_DIR)" ] || (echo "$(RED)✗ Dist directory not found. Run 'make build-release' first$(NC)" && exit 1)
	@[ -f "$(DIST_DIR)/halo-darwin-arm64" ] || (echo "$(RED)✗ ARM64 binary not found$(NC)" && exit 1)
	@[ -f "$(DIST_DIR)/halo-darwin-x64" ] || (echo "$(RED)✗ x64 binary not found$(NC)" && exit 1)
	@echo "$(GREEN)✓ All prerequisites met$(NC)"

_create-release: ## Internal: Create GitHub release and upload binaries
	@echo "$(BLUE)Creating GitHub release v$(VERSION)...$(NC)"
	@gh release create v$(VERSION) \
		--title "Halo v$(VERSION)" \
		--notes "Release v$(VERSION) - Local development guardian" \
		$(DIST_DIR)/halo-darwin-arm64 \
		$(DIST_DIR)/halo-darwin-x64 \
		|| echo "$(YELLOW)Release already exists, uploading assets...$(NC)"
	@echo "$(GREEN)✓ Release created$(NC)"

_update-homebrew-tap: ## Internal: Update Homebrew formula with checksums
	@echo "$(BLUE)Updating Homebrew formula...$(NC)"
	@if [ ! -d "$(HOMEBREW_TAP)" ]; then \
		echo "$(YELLOW)Cloning homebrew-tap...$(NC)"; \
		git clone https://github.com/freedomforeversolar/homebrew-tap.git $(HOMEBREW_TAP); \
	fi
	@cd $(HOMEBREW_TAP) && git pull
	@mkdir -p $(HOMEBREW_TAP)/Formula
	@echo "$(BLUE)Calculating SHA256 checksums...$(NC)"
	@ARM64_SHA=$$(shasum -a 256 $(DIST_DIR)/halo-darwin-arm64 | cut -d' ' -f1); \
	X64_SHA=$$(shasum -a 256 $(DIST_DIR)/halo-darwin-x64 | cut -d' ' -f1); \
	echo "  ARM64: $$ARM64_SHA"; \
	echo "  x64:   $$X64_SHA"; \
	sed -e "s/version \".*\"/version \"$(VERSION)\"/" \
	    -e "s|v[0-9]*\.[0-9]*\.[0-9]*/halo-darwin-arm64|v$(VERSION)/halo-darwin-arm64|g" \
	    -e "s|v[0-9]*\.[0-9]*\.[0-9]*/halo-darwin-x64|v$(VERSION)/halo-darwin-x64|g" \
	    -e "/on_arm/,/end/ s/sha256 \"[^\"]*\"/sha256 \"$$ARM64_SHA\"/" \
	    -e "/on_intel/,/end/ s/sha256 \"[^\"]*\"/sha256 \"$$X64_SHA\"/" \
	    halo.rb > $(HOMEBREW_TAP)/Formula/halo.rb
	@cd $(HOMEBREW_TAP) && \
		git add Formula/halo.rb && \
		git commit -m "Update Halo to v$(VERSION)" && \
		git push origin main
	@echo "$(GREEN)✓ Homebrew formula updated$(NC)"

# Quick release without homebrew tap update
release: build-release _check-deploy-ready _create-release ## Build and create GitHub release only (no Homebrew update)
	@echo "$(GREEN)✓ Release v$(VERSION) created$(NC)"
	@echo ""
	@echo "GitHub release created with binaries."
	@echo "Update Homebrew tap manually or run: make deploy"

# Version bumping
bump-version: ## Bump version in package.json and Makefile
	@echo "Current version: $(VERSION)"
	@read -p "Enter new version: " NEW_VERSION; \
	sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" package.json; \
	sed -i '' "s/VERSION := .*/VERSION := $$NEW_VERSION/" Makefile; \
	echo "$(GREEN)✓ Version bumped to $$NEW_VERSION$(NC)"

# Allow passing arguments to dev target
%:
	@:
