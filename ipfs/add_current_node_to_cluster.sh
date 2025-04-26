
# How to run this file 
# chmod +x script.sh
# ./script.sh <CLUSTER_SECRET> <BOOTSTRAP_PEER>

#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <CLUSTER_SECRET> <BOOTSTRAP_PEER>"
    exit 1
fi

IPFS_VERSION="v0.21.0"
IPFS_CLUSTER_VERSION="v0.14.2"
CLUSTER_SECRET=$1
BOOTSTRAP_PEER=$2

echo "Updating system and installing dependencies..."
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y wget tar jq curl coreutils

if ! command -v nohup &> /dev/null; then
    echo "nohup is not installed. Installing..."
    sudo apt install -y coreutils
else
    echo "nohup is already installed."
fi

echo "Installing IPFS version $IPFS_VERSION..."
wget https://dist.ipfs.tech/kubo/${IPFS_VERSION}/kubo_${IPFS_VERSION}_linux-amd64.tar.gz
tar -xvzf kubo_${IPFS_VERSION}_linux-amd64.tar.gz
sudo mv kubo/ipfs /usr/local/bin/ipfs
rm -rf kubo*

echo "Initializing IPFS..."
ipfs init

echo "Starting IPFS daemon..."
nohup ipfs daemon > /dev/null 2>&1 &

echo "Installing IPFS Cluster version $IPFS_CLUSTER_VERSION..."
wget https://dist.ipfs.tech/ipfs-cluster-service/${IPFS_CLUSTER_VERSION}/ipfs-cluster-service_${IPFS_CLUSTER_VERSION}_linux-amd64.tar.gz
tar -xvzf ipfs-cluster-service_${IPFS_CLUSTER_VERSION}_linux-amd64.tar.gz
sudo mv ipfs-cluster-service/ipfs-cluster-service /usr/local/bin/
rm -rf ipfs-cluster-service*

wget https://dist.ipfs.tech/ipfs-cluster-ctl/${IPFS_CLUSTER_VERSION}/ipfs-cluster-ctl_${IPFS_CLUSTER_VERSION}_linux-amd64.tar.gz
tar -xvzf ipfs-cluster-ctl_${IPFS_CLUSTER_VERSION}_linux-amd64.tar.gz
sudo mv ipfs-cluster-ctl/ipfs-cluster-ctl /usr/local/bin/
rm -rf ipfs-cluster-ctl*

echo "Initializing IPFS Cluster..."
ipfs-cluster-service init

echo "Configuring IPFS Cluster with the given secret..."
echo "$CLUSTER_SECRET" > ~/.ipfs-cluster/secret
chmod 600 ~/.ipfs-cluster/secret
sed -i "s/\"secret\":.*/\"secret\": \"$CLUSTER_SECRET\",/" ~/.ipfs-cluster/service.json


echo "Joining cluster via bootstrap peer: $BOOTSTRAP_PEER"
ipfs-cluster-service daemon --bootstrap "$BOOTSTRAP_PEER" &

echo "Fetching IPFS node IP..."
IPFS_IP=$(ipfs id | jq -r '.Addresses')
echo "IPFS Node IP: $IPFS_IP"

echo "IPFS and IPFS Cluster setup complete!"


