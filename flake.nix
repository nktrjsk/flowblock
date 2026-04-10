{
  description = "FlowBlock dev shell";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        startChromium = pkgs.writeShellScriptBin "start-chromium-debug" ''
          chromium --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile "$@" &
          echo "Chromium spuštěno s remote debugging na portu 9222"
        '';
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.bun
            pkgs.git
            pkgs.claude-code
            pkgs.screen
            pkgs.gh
            pkgs.chromium
            startChromium
          ];
          shellHook = ''
            echo "FlowBlock dev shell ready"
            echo "Node: $(node --version), Bun: $(bun --version)"
            echo "Pro debugging spusť: start-chromium-debug"

            # Nastav chrome-devtools MCP pokud ještě není
            if ! claude mcp list 2>/dev/null | grep -q "chrome-devtools"; then
              claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest
              # Přidej CHROME_CDP_URL do konfigurace
              node -e "
                const fs = require('fs');
                const path = require('os').homedir() + '/.claude.json';
                const config = JSON.parse(fs.readFileSync(path, 'utf8'));
                if (config.mcpServers?.['chrome-devtools']) {
                  config.mcpServers['chrome-devtools'].env = { CHROME_CDP_URL: 'http://localhost:9222' };
                  fs.writeFileSync(path, JSON.stringify(config, null, 2));
                  console.log('chrome-devtools MCP nakonfigurován');
                }
              "
            fi
          '';
        };
      }
    );
}
