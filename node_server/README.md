# ACE Quill Server

The ACE Quill Server is a component of the ACE Quill Prototype. The ACE Quill
server was developed in Amazon Web Services (AWS) on a CentOS 7.4 Linux
instance running on a t2.medium Elastic Compute Cloud (EC2) instance. A local
server could also be used, and the CentOS Linux installation instructions can
be found on the [CentOS](https://www.centos.org) website.

The ACE Quill Server performs two main tasks:
1. Provides a web-based interface for researchers and administrators to
select speech to text (STT) engines, manage user accounts, and review
research data.
1. Records a call on the Asterisk PBX as a WAV file, sends the WAV file to a
STT engine, and sends transcribed text to the ACE Quill Client application
using Session Initiation Protocol (SIP) messages.

### MySQL Database Installation
This section provides an overview of the MySQL server along with installation
and setup documentation.

Install dependent packages:

```
sudo yum install unixODBC unixODBC-devel libtool-ltdl libtool-ltdl-devel
mysql-connector-odbc
```

Download the Yum repository configuration file:

```
wget https://dev.mysql.com/get/mysql57-community-release-el7-9.noarch.rpm
```

Install the Yum repository configuration file:

```
sudo rpm -ivh mysql57-community-release-el7-9.noarch.rpm
```

Install the MySQL server:

```
sudo yum install mysql-server
```

Start the MySQL server:

```
sudo systemctl start mysqld
```

A temporary password is generated as part of the installation process. It is
in the mysqld.log file and can be found with this command:

```
sudo grep 'temporary password' /var/log/mysqld.log
```

MySQL includes a security script to change some of the default, non-secure
options:

```
sudo mysql_secure_installation
```

As part of the security script, the user will be prompted for a new password.
The new password must be at least 12-characters and contain at least one
uppercase letter, one lowercase letter, one number and once special character.

To stop the MySQL server:

```
sudo systemctl stop mysqld
```

### MySQL Database Configuration
The ACE Quill prototype requires the user to create two MySQL databases and user accounts.

Enter the MySQL shell, enter the root password when prompted:

```
mysql -uroot -p
```

Inside the MySQL shell, create the following databases and accounts for access:

```
mysql> create database asterisk;
mysql> create database ace_quill;
```

Create the database accounts and issue the account grant statements:

```
mysql> grant all on asterisk.* to 'ace_quill'@'localhost' identified by
'password here';

mysql> grant all on ace_quill.* to 'ace_quill'@'localhost' identified by
'password here';
```

Exit the MySQL shell:

```
mysql> exit;
```

The next step is to instantiate the databases. The asterisk_schema.txt and
ace_quill_schema.txt files are included as part of the public release download.

From the command prompt (not the MySQL prompt) type the following and enter
the password when prompted:

```
mysql -uace_quill -p asterisk < asterisk_schema.txt`

mysql -uace_quill -p ace_quill < ace_quill_schema.txt`
```

### ACE Quill Server Software Installation
1. Clone the ACE Quill server repository:
```
git clone https://github.com/FCC/ace_quill/ace_quill_server.git`
```
2. Install [Node.js](https://nodejs.org/en/) >= version 8.x
1. Install [Bower]() https://bower.io >= v1.8.0 by running
```
npm install -g bower
```
4. Install [Gulp](https://gulpjs.com) >= v3.9.1 by running
```
npm install -g gulp-cli
```

5. Type
```
cd ace_quill_server
```
6. Type
```
cd node_server
```
7. Install the required Node.js modules: from the ace_quill_server directory,
run
```
npm install
```
8. Install the required Bower packages: from the ace_quill_server directory,
run
```
bower install
```
9. Install [PM2](https://www.npmjs.com/package/pm2) >= v2.4.6 by running
```npm install -g pm2```

### SSL Configuration
1. ACE Quill software uses SSL which requires a valid key and certificate.
1. Enable SSL by specifying `https` as the protocol value in the config.json
file.
1. The location of the SSL key and certificate can be specified in the
config.json by using the ssl:cert and ssl:key parameters in the form of
folder/file (e.g., ssl/mycert.pem and ssl/mykey.pem)

### Speech-to-Text Engine Configuration
The ACE Quill prototype was developed to support interfaces to the following STT
engines:
* Google Speech (https://cloud.google.com)
* IBM Watson (https://www.ibm.com/watson/services/speech-to-text/)
* Microsoft Azure (https://azure.microsoft.com/en-us/services/cognitive-services/speech/)

Follow the link for each STT engine, create an account, and download the
account credentials as a JSON file.

#### Google
Two environment variables are required for Google:
```
export GOOGLE_APPLICATION_CREDENTIALS='<install path>/ace_quill_server/stt_configs/google-speech.json'

export GCLOUD_PROJECT='<account credentials here>'
```

#### Watson
If behind a proxy, Watson uses a TCP connection to `wss://stream.watsonplatform.net/speech-to-text/api` for its speech to text
services. If the ACE Quill server is running behind a proxy, the url will need
to be whitelisted OR a modification to the watson-developer-cloud node module is
required, see below:


```
cd node_modules/watson-developer-cloud/speech-to-text
vi recognize_stream.js
```

Search for the `W3CWebSocket` block which should look similar to this:
```javascript
// node params: requestUrl, protocols, origin, headers, extraRequestOptions
// browser params: requestUrl, protocols (all others ignored)
const socket = (this.socket = new W3CWebSocket(
    url,
    null,
    null,
    options.headers,
    null
));
```
Create a `proxy-agent` then add it as the extraRequestOptions
```javascript
//Server requires proxy
const ProxyAgent = require('proxy-agent');
const extraRequestOptions = {
 agent: new ProxyAgent("<your proxy address>")
};
// node params: requestUrl, protocols, origin, headers, extraRequestOptions
// browser params: requestUrl, protocols (all others ignored)
const socket = (this.socket = new W3CWebSocket(
    url,
    null,
    null,
    options.headers,
    extraRequestOptions  //was null
));
```

###	Server Software Configuration
The ace_quill_server/node_server directory contains a file named config.json
that contains all of the configuration parameters used by the server. The
configuration parameters and their definitions are shown below.

|Parameter | Data Type | Example | Definition  |
| ------------- |---------| --------|-------------|
| cleartext     | Boolean | "true" | Indicates if configs are encoded in Base64 or plain text |
| debuglevel      | ALL<br>TRACE<br>DEBUG<br>INFO<br>WARN<br>ERROR<br>FATAL<br>OFF | "ERROR" | The debug level for the logger |
| port | Number | "3000" | Listen TCP port for the server|
| version | Number | "1.0" | The version of the service, appears in the footer of the website|
| proxy | URL or IP address | "http://127.0.0.1:8442" | Server proxy - if not required set it to empty quotes ""|
| ssl > key | File path | "/etc/ssl/keys/server.key" | The path to the SSL key|
| ssl > cert | File path | "/etc/ssl/certs/server.crt" | The path to the SSL certificate|
| session > name | String | "acequillsession" | Name used to identify the session|
| session > secret | String | "SecretPhrase123%" | Password used by the session|
| sttService | Enabled<br>Disabled | "enabled" | Toggles speech to text services on or off|
| transcriptFilePath | File path | "/tmp/transcripts/" | The path to the directory that will contain the transcript files|
| wavFilePath | File path | "/tmp/wavFiles/" | The path to the directory that will contain the WAV files|
| videoFilePath | File path | "/tmp/videoUploads/" | The path to the directory that will contain the video file uploads|
| mysql > host | IP address | "localhost" | The MySQL hostname or IP address for the database server|
| mysql > user | String | "acequillUser" | MySQL username for the acequill user|
| mysql > password | String | "MyFakePW123%" | The MySQL password for the acequill user|
| mysql > database | String | "acequill" | Name of the database used to store the ACE Quill data|
| asterisk > port | Number | "5038" | The Asterisk manager port, defaults to 5038|
| asterisk > host | IP address | "127.0.0.1" | Asterisk hostname <br> Note that Asterisk must reside on the same Linux instance as the ACE Quill server|
| asterisk > user | String | "asteriskAQ" | The Asterisk username for authentication |
| asterisk > password | String | "AQaccount123%" | Asterisk password for the Asterisk username|

The following is an sample of a valid config.json file:

```json
{
    "cleartext": "true",
    "debuglevel": "ERROR",
    "port": "3000",
    "version": "1.0",
    "proxy":"http://127.0.0.1:8442",
    "ssl" : {
      "key": "/etc/ssl/keys/server.key",
      "cert": "/etc/ssl/certs/server.crt"
    },
    "session": {
      "name":"acequillsession",
      "secret": "SecretPhrase123%"
    },
    "sttService": "enabled",
    "transcriptFilePath": "/tmp/transcripts/",
    "wavFilePath": "/tmp/wavFiles/",
    "videoFilePath":"/tmp/videoUploads/",
    "mysql": {
      "host": "localhost",
      "user": "acequillUser",
      "password": "MyFakePW123%",
      "database": "acequill"
    },
    "asterisk": {
      "port": 5038,
      "host": "127.0.0.1",
      "user": "asteriskAQ",
      "password": "AQaccount123%"
    }
}
```

## Starting the Server
To start the ACE Quill Server:
* `cd ace_quill_server`
* `cd node_server`
* Run `npm start` or `node bin/www`

### Accessing the Researcher Site
1. ACE Quill Admin, go to: https://host:port/nginxPath/admin




### Using NGINX as a Reverse Proxy
If the ACE Quill server is behind an NGINX reverse proxy, NGINX will require
a subfilter to be enabled. Below is an example of an NGINX location block for
the ACE Quill server. In this example the ACE Quill server would be accessed
using a web browser at the following URL:

`https://<nginx-fqdn>/acequill/admin`

The NGINX location block will be added to the NGINX config file which is
usually located in /etc/nginx/nginx.conf.

```
  location /acequill {
    proxy_pass https://acequillserverip:port/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    sub_filter_once off;
    sub_filter 'href="/' 'href="/acequill/';
    sub_filter "href='/" "href='/acequill/";
    sub_filter 'src="/' 'src="/acequill/';
    sub_filter "src='/" "src='/acequill/";
    sub_filter 'path:"/socket.io"' 'path:"/acequill/socket.io"';
    sub_filter "path:'/socket.io'" "path:'/acequill/socket.io'";

    proxy_redirect https://acequillserverip:port/acequill/ /acequill/;
  }
```



### NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive,
McLean, VA 22102-7539, (703) 983-6000.

©2018 The MITRE Corporation.
