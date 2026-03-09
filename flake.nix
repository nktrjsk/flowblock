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
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.bun
            pkgs.git
	    pkgs.claude-code
          ];

          shellHook = ''
            echo "FlowBlock dev shell ready"
            echo "Node: $(node --version), Bun: $(bun --version)"
          '';
        };
      }
    );
}
