FROM mcr.microsoft.com/devcontainers/typescript-node:22
RUN apt-get update && apt-get install -y direnv
RUN curl -fsSL https://starship.rs/install.sh | sh -s -- -y
RUN npm install -g npm@latest

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh

# Switch to node user for user-specific global installs
USER node
RUN curl -fsSL https://claude.ai/install.sh | bash
