{ pkgs, lib, config, inputs, ... }:

{
  # Project name
  name = "tv-screener-plus";

  # Enable languages
  languages.python = {
    enable = true;
    version = "3.11";
    venv.enable = true;
    venv.requirements = ./screener-service/requirements.txt;
  };

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_20;
  };

  # Additional packages
  packages = with pkgs; [
    git
    curl
    jq
  ];

  # Environment variables
  env = {
    # Python service
    SCREENER_SERVICE_PORT = "8001";
    LOG_LEVEL = "info";

    # TypeScript app
    APP_PORT = "3000";
    SCREENER_SERVICE_URL = "http://localhost:8001";
    DATABASE_PATH = "./data/tvscreener.db";

    # Development
    NODE_ENV = "development";
  };

  # Scripts for common tasks
  scripts = {
    dev-python.exec = ''
      cd screener-service
      python src/main.py
    '';

    dev-node.exec = ''
      cd app
      npm run dev
    '';

    test-python.exec = ''
      cd screener-service
      pytest
    '';

    test-node.exec = ''
      cd app
      npm test
    '';
  };

  # Pre-commit hooks (optional, can enable later)
  # pre-commit.hooks = {
  #   black.enable = true;
  #   eslint.enable = true;
  # };

  # Enter shell message
  enterShell = ''
    echo ""
    echo "🚀 TV Screener+ Development Environment"
    echo "========================================"
    echo "Python: $(python --version)"
    echo "Node:   $(node --version)"
    echo ""
    echo "Commands:"
    echo "  dev-python   - Start Python screener service"
    echo "  dev-node     - Start TypeScript app"
    echo "  test-python  - Run Python tests"
    echo "  test-node    - Run Node tests"
    echo ""
  '';
}
