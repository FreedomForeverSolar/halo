.PHONY: help build install uninstall clean test dev bump-version

# Variables
BINARY_NAME := halo
INSTALL_PATH := /usr/local/bin

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

clean: ## Remove built binary
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -f $(BINARY_NAME)
	@echo "$(GREEN)✓ Cleaned$(NC)"

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	@bun test

dev: ## Run in development mode
	@bun run dev $(filter-out $@,$(MAKECMDGOALS))

# Version bumping
bump-version: ## Update version in package.json
	@CURRENT_VERSION=$$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/'); \
	echo "Current version: $$CURRENT_VERSION"; \
	read -p "Enter new version: " NEW_VERSION; \
	sed -i '' "s/\"version\": \".*\"/\"version\": \"$$NEW_VERSION\"/" package.json; \
	echo "$(GREEN)✓ Version bumped to $$NEW_VERSION$(NC)"; \
	echo ""; \
	echo "Next steps:"; \
	echo "  1. Commit: git commit -am 'chore: bump version to $$NEW_VERSION'"; \
	echo "  2. Tag: git tag -a v$$NEW_VERSION -m 'Release v$$NEW_VERSION'"; \
	echo "  3. Push: git push origin main --tags"

# Allow passing arguments to dev target
%:
	@:
