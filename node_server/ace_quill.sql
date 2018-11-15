-- MySQL dump 10.13  Distrib 5.7.22, for Linux (x86_64)
--
-- Host: localhost    Database: ace_quill
-- ------------------------------------------------------
-- Server version	5.7.22

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contacts` (
  `idcontacts` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(64) DEFAULT NULL,
  `cellphone` varchar(16) DEFAULT NULL,
  `workphone` varchar(16) DEFAULT NULL,
  `homephone` varchar(16) DEFAULT NULL,
  `faxphone` varchar(16) DEFAULT NULL,
  `personalemail` varchar(64) DEFAULT NULL,
  `workemail` varchar(64) DEFAULT NULL,
  `favorite` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`idcontacts`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_map`
--

DROP TABLE IF EXISTS `device_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_map` (
  `device_id` varchar(64) NOT NULL,
  `device_name` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_settings`
--

DROP TABLE IF EXISTS `device_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `extension` smallint(5) DEFAULT NULL,
  `stt_engine` varchar(45) DEFAULT NULL,
  `delay` smallint(2) DEFAULT NULL,
  `default_device` tinyint(1) DEFAULT '0',
  `name` varchar(45) DEFAULT NULL,
  `group_id` int(11) DEFAULT NULL,
  `groups` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `extension_UNIQUE` (`extension`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `groups` (
  `idgroups` int(11) NOT NULL AUTO_INCREMENT,
  `group_name` varchar(45) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`idgroups`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `login_credentials`
--

DROP TABLE IF EXISTS `login_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_credentials` (
  `idlogin_credentials` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(45) DEFAULT NULL,
  `first_name` varchar(45) DEFAULT NULL,
  `last_name` varchar(45) DEFAULT NULL,
  `password` varchar(150) DEFAULT NULL,
  `role` varchar(45) DEFAULT NULL,
  `group_id` int(11) DEFAULT NULL,
  `groups` varchar(45) DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`idlogin_credentials`),
  UNIQUE KEY `username_UNIQUE` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `registration_data`
--

DROP TABLE IF EXISTS `registration_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `registration_data` (
  `extension` smallint(5) NOT NULL,
  `build_number` varchar(64) DEFAULT NULL,
  `git_commit` varchar(64) DEFAULT NULL,
  `device_id` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `research_data`
--

DROP TABLE IF EXISTS `research_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `research_data` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(256) NOT NULL,
  `extension` smallint(5) NOT NULL,
  `src_channel` varchar(32) NOT NULL,
  `dest_channel` varchar(32) NOT NULL,
  `call_start` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unique_id` varchar(32) NOT NULL,
  `dest_phone_number` varchar(16) NOT NULL,
  `stt_engine` varchar(45) NOT NULL,
  `call_accuracy` tinyint(2) unsigned NOT NULL,
  `added_delay` tinyint(2) unsigned NOT NULL,
  `transcription_file_path` varchar(256) NOT NULL,
  `transcription_file` varchar(256) NOT NULL,
  `audio_file_path` varchar(256) NOT NULL,
  `audio_file` varchar(256) NOT NULL,
  `video_file` varchar(256) DEFAULT NULL,
  `call_end` timestamp NULL DEFAULT NULL,
  `call_duration` int(11) unsigned DEFAULT NULL,
  `build_number` varchar(256) DEFAULT NULL,
  `git_commit` varchar(256) DEFAULT NULL,
  `scenario_number` tinyint(2) DEFAULT NULL,
  `notes` text,
  `mobizen_notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idnew_table_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1477 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-05-08 20:19:15
