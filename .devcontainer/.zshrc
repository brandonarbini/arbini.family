export ZSH="$HOME/.oh-my-zsh"
ZSH_DISABLE_COMPFIX=true
DISABLE_AUTO_TITLE="true"
HIST_STAMPS="yyyy-mm-dd"
plugins=(
  aws
  bundler
  docker
  docker-compose
  emoji
  gem
  git
  github
  golang
  heroku
  macos
  node
  npm
  nvm
  rails
  rake
  rbenv
  react-native
  redis-cli
  ruby
  yarn
)
source $ZSH/oh-my-zsh.sh

# editor
if [[ -n $SSH_CONNECTION ]]; then
  export EDITOR='vim'
else
  export EDITOR='code -w'
fi

# zsh history
export HISTFILE=/command-history/.zsh_history
export HISTFILESIZE=1000000
export HISTSIZE=1000000
export HSTR_CONFIG=blacklist,hicolor,prompt-bottom
export HSTR_PROMPT="$ "
export HH_CONFIG=hicolor

# Git commands
alias gpl='git pull'
alias gps='git push'

# Node
alias rnm="rm -rf node_modules"

# less
export LESS="--no-init --quit-if-one-screen -R"

# direnv
eval "$(direnv hook zsh)"

# starship
eval "$(starship init zsh)"
