# Homebrew Formula for Halo
# To be placed in freedomforeversolar/homebrew-tap repository

class Halo < Formula
  desc "Local DNS and SSL management tool for development"
  homepage "https://github.com/freedomforeversolar/halo"
  version "1.0.0"
  license "MIT"

  # Different URLs for different architectures
  on_arm do
    url "https://github.com/freedomforeversolar/halo/releases/download/v1.0.0/halo-darwin-arm64"
    sha256 "" # Will be generated after release
  end

  on_intel do
    url "https://github.com/freedomforeversolar/halo/releases/download/v1.0.0/halo-darwin-x64"
    sha256 "" # Will be generated after release
  end

  depends_on "caddy"
  depends_on "dnsmasq"

  def install
    # The downloaded file is already a compiled executable
    bin.install "halo-darwin-#{Hardware::CPU.arch}" => "halo"
  end

  def post_install
    # Ensure dnsmasq is started
    system "brew", "services", "start", "dnsmasq" unless system("brew services list | grep dnsmasq | grep started")
  end

  def caveats
    <<~EOS
      🔵 Halo has been installed!
      
      To complete setup, run:
        halo setup

      This will configure DNS and SSL certificates for local development.
      
      Quick start:
        halo setup
        halo add portal.myapp localhost:3000
        open https://portal.myapp
    EOS
  end

  test do
    assert_match "1.0.0", shell_output("#{bin}/halo --version")
  end
end
