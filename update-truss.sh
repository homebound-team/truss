#!/bin/bash

MAPPINGS_FILE="update-truss-diff.txt"

# Read the mappings file line by line
while IFS= read -r OLD_STRING && IFS= read -r NEW_STRING; do
    find "src" -type f -exec sed -i "s/\.$OLD_STRING\b/\.$NEW_STRING/g" {} +
done < "$MAPPINGS_FILE"
