#!/bin/bash
set -e

package_name=$(jq -r '.name' package.json)
version=$(jq -r '.version' package.json)

# remove "@" and replace "/" with "-" in the package name for the tarball filename.
name=${package_name//@/}
name=${name//\//-}

echo "Building and installing ${package_name} version ${version} globally..."
bun run build
rm -f ${name}-*.tgz
npm pack
npm uninstall --global ${name} || true
npm i --global ./${name}-${version}.tgz
rm -f ${name}-${version}.tgz

echo "Successfully installed ${package_name} version ${version} globally."
