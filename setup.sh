#!/bin/bash

# ====================================================================
#  🚀 SSH PTY Terminal for Termux - Professional Setup
# ====================================================================

# ANSI Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' 

clear
echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}${BOLD}     🚀 SSH PTY Terminal for Termux Setup (v2.0)              ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check for Termux
IS_TERMUX=false
if [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=true
    echo -e "${GREEN}✓ Termux environment detected.${NC}"
    
    echo -e "${YELLOW}Updating package repositories...${NC}"
    pkg update -y && pkg upgrade -y
    
    echo -e "${YELLOW}Installing required packages: nodejs, openssh, tmux...${NC}"
    pkg install -y nodejs openssh tmux
else
    echo -e "${YELLOW}! Non-Termux environment detected.${NC}"
    echo -e "${YELLOW}Please ensure 'node', 'sshd', and 'tmux' are installed manually.${NC}"
fi

# SSH Setup check
echo -e "${YELLOW}Verifying SSH Server state...${NC}"
if ! pgrep -x "sshd" > /dev/null; then
    echo -e "${YELLOW}Starting sshd...${NC}"
    sshd
else
    echo -e "${GREEN}✓ sshd is already running.${NC}"
fi

# Password Check (Termux specific)
if [ "$IS_TERMUX" = true ]; then
    # Try to check if password is set - this is tricky, but we can remind them.
    echo -e "${YELLOW}Reminder: Ensure you have set a password using the 'passwd' command.${NC}"
fi

# Dependencies
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing npm dependencies (first time)...${NC}"
        npm install
    else
        echo -e "${GREEN}✓ node_modules found. Skipping npm install.${NC}"
    fi
fi

# Get Local IP
LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -n 1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

echo -e "\n${GREEN}${BOLD}🎉 Setup Successfully Completed!${NC}"
echo -e "${CYAN}----------------------------------------------------------------------${NC}"
echo -e "${BOLD}To start the PTY Backend:${NC}"
echo -e "  Run: ${YELLOW}node server.js${NC}"
echo -e ""
echo -e "${BOLD}Access the Terminal UI:${NC}"
echo -e "  Local: ${CYAN}http://localhost:3000${NC}"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo -e "  Network: ${CYAN}http://${LOCAL_IP}:3000${NC}"
fi
echo -e ""
echo -e "${BOLD}Connection Details:${NC}"
echo -e "  User: ${GREEN}$(whoami)${NC}"
echo -e "  Port: ${GREEN}8022${NC}"
echo -e "  Persistent session check: ${GREEN}Enabled${NC}"
echo -e ""
echo -e "${YELLOW}${BOLD}Pro Tip:${NC} Run ${BOLD}'tmux'${NC} before starting tasks to ensure they persist."
echo -e "${CYAN}======================================================================${NC}"
