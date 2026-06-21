#!/bin/bash

# ====================================================================
#  🚀 SSH PTY Terminal for Termux - Minimal Setup
# ====================================================================

# ANSI Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

clear
echo -e "${CYAN}======================================================================${NC}"
echo -e "${GREEN}     🚀 SSH PTY Terminal for Termux Setup              ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Check for Termux
if [ -d "/data/data/com.termux" ]; then
    echo -e "${GREEN}✓ Termux detected.${NC}"
    pkg update -y
    pkg install -y nodejs openssh
else
    echo -e "${YELLOW}! Not a Termux environment. Ensure nodejs and openssh are installed.${NC}"
fi

# SSH Setup
echo -e "${YELLOW}Starting SSH Server...${NC}"
sshd

# Password Reminder
echo -e "${CYAN}Tip: Use 'passwd' in Termux to set your SSH password if you haven't yet.${NC}"

# Dependencies
if [ -f "package.json" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
fi

echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo -e "Run: ${YELLOW}node server.js${NC}"
echo -e "Open: ${CYAN}http://localhost:3000${NC}"
echo -e "\nUsername: ${GREEN}$(whoami)${NC}"
echo -e "SSH Port: ${GREEN}8022${NC}"
echo -e "${CYAN}======================================================================${NC}"
