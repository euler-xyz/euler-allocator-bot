#!/bin/bash
# colors calculation -> https://stackoverflow.com/a/43204824/6719761

YELLOW=`tput setaf 3`
BOLD=`tput bold`
RESET=`tput sgr0`

doppler login
EXITCODE=$?

# Error 127 is thrown when doppler is not installed | command not found
if [ "$EXITCODE" = "127" ]; then
    echo "${YELLOW}${BOLD}Doppler CLI is probably not installed. Please go to https://docs.doppler.com/docs/install-cli and follow the instructions for your OS.${RESET}"
    exit $EXITCODE
fi
