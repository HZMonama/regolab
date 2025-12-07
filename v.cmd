@echo off
REM Windows wrapper script for version management
REM Usage: v bump patch

node scripts/version.js %*

