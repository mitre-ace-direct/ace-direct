#!/bin/bash

# Assumptions:
# OpenJDK is installed
# OpenFX SDK is installed
# Environment variables are defined as in the development environment
# obusylight-1.0-jar-with-dependencies.jar is in the same folder as this script

java --module-path ${OPENFX_SDK}/lib --add-modules=javafx.controls -jar obusylight-1.0-jar-with-dependencies.jar
