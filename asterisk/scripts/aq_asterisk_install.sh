#!/bin/bash

# This will stop the script if any of the commands fail
set -e

source /etc/environment
startPath=$(pwd)

echo "startPath is $startPath"

# Set variable names
STUN_PORT='insert port number'
STUN_SERVER='insert stun server'
CRT_KEY='insert path to key'
CRT_FILE='insert path to cert'
LOCAL_IP_MASK='insert local netmask'
LOCAL_IP='insert local ip address'
PUBLIC_IP='insert public ip address'
TWILIO_FQDN='insert twilio fqdn'

# Specify Asterisk version
AST_VERSION=13.8.0

# Hostname command suggestion
HOST_SUGG="You can use 'sudo hostnamectl set-hostname <hostname>' to set the hostname."

print_args()
{
  echo "Required params: --public-ip --local-ip --local-ip-mask --crt-file --crt-key --twilio-fqdn --stun-server --stun-port" >&2
  echo "Aborting" >&2
  exit 1
} >&2

# Check for empty params
if [ $# -eq 0 ]
  then
    echo "No arguments supplied"
    print_args
    exit 1
fi

# Read the options
# TEMP=`getopt -o a:: -l public-ip:,local-ip:,crt-file:,crt-key: -n '$0' -- "$@"`
TEMP=`getopt -o a:: -l public-ip:,local-ip:,local-ip-mask:,crt-file:,crt-key:,twilio-fqdn:,stun-server:,stun-port: -n '$0' -- "$@"`
eval set -- "$TEMP"

# Process the command line arguments
while true
do
        case "$1" in
        --public-ip)
                case $2 in
                        "") print_args ;;
                        *) PUBLIC_IP=$2; shift 2 ;;
                esac ;;
        --local-ip)
                case "$2" in
                        "") print_args ;;
                        *) LOCAL_IP=$2; shift 2 ;;
                esac ;;
        --local-ip-mask)
                case "$2" in
                        "") print_args ;;
                        *) LOCAL_IP_MASK=$2; shift 2 ;;
                esac ;;
        --crt-file)
                case "$2" in
                        "") echo -e "WARNING: no SSL/TLS certificate specified. Using to-be-generated self-signed\nAsterisk certificate."
                        CRT_FILE="//etc//asterisk//keys//asterisk.pem"; shift 2;;
                        *) CRT_FILE=$2; shift 2 ;;
                esac ;;
        --crt-key)
                case "$2" in
                        "") CRT_KEY="//etc//asterisk//keys//asterisk.key"; shift 2;;
                        *) CRT_KEY=$2; shift 2 ;;
                esac ;;
        --twilio-fqdn)
                case "$2" in
                      "") print_args ;;
                      *) TWILIO_FQDN=$2; shift 2 ;;
                esac ;;
        --stun-server)
                case "$2" in
                      "") print_args ;;
                      *) STUN_SERVER=$2; shift 2 ;;
                esac ;;
        --stun-port)
                case "$2" in
                      "") print_args ;;
                      *) STUN_PORT=$2; shift 2 ;;
                esac ;;


        --) shift ; break ;;
        *) echo "Error parsing args"; print_args;;
    esac
done

# Set defaults for non-required options

if [ -z $CRT_FILE ]
then
    echo -e "WARNING: no SSL/TLS certificate specified. Using to-be-generated\nself-signed Asterisk certificate."
    CRT_FILE="\/etc\/asterisk\/keys\/asterisk.crt"
fi

if [ -z $CRT_KEY ]
then
    CRT_KEY="\/etc\/asterisk\/keys\/asterisk.key"
fi


# Check for IPv6 and SElinux - we want both disabled
DISABLED="disabled"
SESTATUS=$(sestatus | head -1 | awk '{print $3}')
IPV6=$(cat /proc/net/if_inet6)

if [ $SESTATUS != $DISABLED ]
then
    echo "ERROR: SELinux must be disabled before running Asterisk. Disable SELinux, reboot the server, and try again."
    exit 1
fi

if [ -n "$IPV6" ]
then
    echo "ERROR: IPv6 must be disabled before installing Asterisk. See README.md for more information. Disable IPv6 then try again"
    exit 1
fi

# Check that a hostname has been set - if not, exit
HOSTNAME=$(hostname -f)
if [ -z $HOSTNAME ]
then
	echo "ERROR: no hostname set on this server. Set the hostname, then restart the script."
	echo $HOST_SUGG
	exit 1
fi

# Ask user to validate hostname
echo -e  "The hostname of this server is currently $HOSTNAME.\nIs this the hostname you want to use with Asterisk? (y/n)"
read response
if [ $response == "n" ]
	then
	echo "Exiting. Set the hostname, then rerun the script."
	echo $HOST_SUGG
	exit 0
fi

# Prompt user to update packages
echo "Packages in your system should be updated. Proceed? (y/n)"
read response2

if [ $response2 == "y" ]
then
    echo "Executing yum update"
    yum -y update
fi

# Installing pre-requisite packages
echo "Installing pre-requisite packages for Asterisk"
# yum -y install -y epel-release bzip2 dmidecode gcc-c++ ncurses-devel libxml2-devel make wget netstat telnet vim zip unzip openssl-devel newt-devel kernel-devel libuuid-devel gtk2-devel jansson-devel binutils-devel git unixODBC unixODBC-devel libtool-ltdl libtool-ltdl-devel mysql-connector-odbc tcpdump

# Download Asterisk
# TODO
# cd /usr/src
mkdir -p /tmp/asterisk
cd /tmp/asterisk
wget http://downloads.asterisk.org/pub/telephony/asterisk/old-releases/asterisk-$AST_VERSION.tar.gz
tar -zxf asterisk-$AST_VERSION.tar.gz && cd asterisk-$AST_VERSION

# Install prerequisites
echo "Running install_prereq script"
./install_prereq install

# Build Asterisk
echo "Running .configure --with-pjproject-bundled"
./configure --with-pjproject-bundled

echo "Running make"
make

echo "Running make install"
make install

echo "Running make config"
make config

#run ldconfig so that Asterisk finds PJPROJECT packages
echo "Running ldconfig"
echo “/usr/local/lib” > /etc/ld.so.conf.d/usr_local.conf
/sbin/ldconfig

echo -e "Generating the Asterisk self-signed certificates. You will be prompted to\nenter a password or passphrase for the private key."
sleep 2

#generate TIS certificates
./contrib/scripts/ast_tls_cert -C $PUBLIC_IP -O "IP CTS" -d /etc/asterisk/keys

# pull down confi/media files and add to /etc/asterisk and /var/lib/asterisk/sounds, respectively
#cd ~
#git clone $GIT_URL
#cd /home/centos/asterisk-codev
repo=$(dirname $startPath)
cd $repo
echo "Repo is $repo"
yes | cp -rf config/* /etc/asterisk

echo "These are the parameters provided:"
echo "HOSTNAME: $HOSTNAME"
echo "CRT_FILE: $CRT_FILE"
echo "CRT_KEY: $CRT_KEY"
echo "TWILIO FQDN: $TWILIO_FQDN"
echo "PUBLIC_IP: $PUBLIC_IP"
echo "LOCAL_IP: $LOCAL_IP"
echo "LOCAL_IP_MASK: $LOCAL_IP_MASK"
echo "STUN_SERVER: $STUN_SERVER"
echo "STUN_PORT: $STUN_PORT"

# Modify configs with named params
echo "Modifiying /etc/asterisk config files"
cd /etc/asterisk
sed -i -e "s/<crt_file>/$CRT_FILE/g" http.conf sip.conf
sed -i -e "s/<crt_key>/$CRT_KEY/g" http.conf sip.conf
sed -i -e "s/<ss_cert>/\/etc\/asterisk\/keys\/asterisk.pem/g" sip.conf
sed -i -e "s/<ss_ca_crt>/\/etc\/asterisk\/keys\/asterisk.crt/g" sip.conf
# sed -i -e "s/<hostname>/$HOSTNAME/g" sip.conf
sed -i -e "s/<public_ip>/$PUBLIC_IP/g" sip.conf
sed -i -e "s/<twilio_fqdn>/$TWILIO_FQDN/g" sip.conf
sed -i -e "s/<local_ip>/$LOCAL_IP/g" sip.conf
sed -i -e "s/<local_ip_mask>/$LOCAL_IP_MASK/g" sip.conf
sed -i -e "s/<crt_file>/$CRT_FILE/g" http.conf
sed -i -e "s/<crt_key>/$CRT_KEY/g" http.conf
sed -i -e "s/<stun_server_port>/$STUN_SERVER:$STUN_PORT/g" res_stun_monitor.conf
sed -i -e "s/<stun_server_port>/$STUN_SERVER:$STUN_PORT/g" rtp.conf

echo ""
echo "NOTE: the user passwords in sip.conf and the Asterisk Manager Interface"
echo "manager password in manager.conf should be updated before starting Asterisk."
echo "Otherwise, the defaults will be used. View the conf files in /etc/asterisk"
echo "for more info."
echo ""
echo "     _    ____ _____    ___  _   _ ___ _     _       "
echo "    / \  / ___| ____|  / _ \| | | |_ _| |   | |      "
echo "   / _ \| |   |  _|   | | | | | | || || |   | |      "
echo "  / ___ \ |___| |___  | |_| | |_| || || |___| |___   "
echo " /_/   \_\____|_____|  \__\_\\\___/|___|_____|_____|  "
echo ""

echo "Installation is complete. When ready, run 'service asterisk start' as root to start Asterisk."
