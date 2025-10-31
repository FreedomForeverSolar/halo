#!/bin/bash
set -e

# Build script for Halo releases
# Generates standalone executables for macOS (arm64 and x64)

VERSION=${1:-"1.0.0"}
OUTPUT_DIR="dist"

echo "🔵 Building Halo v${VERSION}"
echo ""

# Create output directory
mkdir -p ${OUTPUT_DIR}

# Build for ARM64 (Apple Silicon)
echo "Building for arm64..."
bun build ./src/cli.ts --compile --outfile ${OUTPUT_DIR}/halo-darwin-arm64 --target=bun-darwin-arm64

# Build for x64 (Intel)
echo "Building for x64..."
bun build ./src/cli.ts --compile --outfile ${OUTPUT_DIR}/halo-darwin-x64 --target=bun-darwin-x64

# Make executables
chmod +x ${OUTPUT_DIR}/halo-darwin-*

# Show results
echo ""
echo "✅ Build complete!"
echo ""
ls -lh ${OUTPUT_DIR}/

# Generate SHA256 checksums
echo ""
echo "SHA256 checksums:"
shasum -a 256 ${OUTPUT_DIR}/halo-darwin-arm64
shasum -a 256 ${OUTPUT_DIR}/halo-darwin-x64

echo ""
echo "📦 Release files ready in ${OUTPUT_DIR}/"
echo ""
echo "Next steps:"
echo "  1. Create GitHub release: gh release create v${VERSION}"
echo "  2. Upload binaries: gh release upload v${VERSION} ${OUTPUT_DIR}/*"
echo "  3. Update halo.rb with SHA256 checksums"
echo "  4. Push to homebrew-tap repository"
