-- MariaDB Script, works with new install.sh script

-- MySQL dump 10.14  Distrib 5.5.56-MariaDB, for Linux (x86_64)
-- ------------------------------------------------------
-- Server version	5.6.37-log

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


-- IMPORTANT!!!
-- RUN THIS SCRIPT AS an admin MySQL USER

-- PREREQUISITES:
-- Globally replace:
--   _EXTENSION_PASSWORD_
--   _ACEDIRECT_USER_
--   _ASTERISK_USER_
--   _ACEDIRECT_PASSWORD_
--   _ASTERISK_PASSWORD_ 
--   _ACEDIRECT_DB_
--   _ASTERISK_DB_
--   _MEDIA_DB_
--   _CDR_TABLE_

-- create media server database

CREATE DATABASE IF NOT EXISTS _MEDIA_DB_;

-- create fopenam database

CREATE DATABASE IF NOT EXISTS fopenam;

-- create _ASTERISK_DB_ database

CREATE DATABASE IF NOT EXISTS _ASTERISK_DB_; USE _ASTERISK_DB_;
  
CREATE TABLE IF NOT EXISTS `_CDR_TABLE_` ( `calldate` TIMESTAMP NOT NULL default CURRENT_TIMESTAMP, `clid` varchar(80) NOT NULL default '', `src` varchar(80) NOT NULL default '', `dst` varchar(80) NOT NULL default '', `dcontext` varchar(80) NOT NULL default '',  `channel` varchar(80) NOT NULL default '', `dstchannel` varchar(80) NOT NULL default '', `lastapp` varchar(80) NOT NULL default '', `lastdata` varchar(80) NOT NULL default '', `duration` int(11) NOT NULL default '0', `billsec` int(11) NOT NULL default '0', `disposition` varchar(45) NOT NULL default '',  `amaflags` int(11) NOT NULL default '0', `accountcode` varchar(20) NOT NULL default '', `userfield` varchar(255) NOT NULL default '', `uniqueid` VARCHAR(32) NOT NULL default '', `linkedid` VARCHAR(32) NOT NULL default '', `sequence` VARCHAR(32) NOT NULL default '', `peeraccount` VARCHAR(32) NOT NULL default '' );
  
ALTER TABLE `_CDR_TABLE_` ADD INDEX ( `calldate` );
ALTER TABLE `_CDR_TABLE_` ADD INDEX ( `dst` );
ALTER TABLE `_CDR_TABLE_` ADD INDEX ( `accountcode` );


-- create _ACEDIRECT_DB_ database

CREATE DATABASE IF NOT EXISTS _ACEDIRECT_DB_; USE _ACEDIRECT_DB_;

--
-- Table structure for table `agent_data`
--

DROP TABLE IF EXISTS `agent_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_data` (
  `agent_id` int(10) NOT NULL AUTO_INCREMENT,
  `username` varchar(10) NOT NULL,
  `first_name` varchar(20) NOT NULL,
  `last_name` varchar(20) NOT NULL,
  `role` varchar(50) NOT NULL,
  `phone` varchar(12) NOT NULL,
  `email` varchar(40) NOT NULL,
  `organization` varchar(50) NOT NULL,
  `is_approved` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `extension_id` int(10) DEFAULT NULL,
  `queue_id` int(10) DEFAULT NULL,
  `queue2_id` int(10) DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `layout` text,
  PRIMARY KEY (`agent_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_data`
--

LOCK TABLES `agent_data` WRITE;
/*!40000 ALTER TABLE `agent_data` DISABLE KEYS */;
INSERT INTO `agent_data` VALUES (1,'dagent1','George','Washington','AD Agent','111-111-1111','dagent1@portal.com','USA',1,1,4,1,2,NULL,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":6,\"height\":13},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":12}]'),(2,'dagent2','Thomas','Jefferson','AD Agent','222-222-2222','dagent2@portal.com','USA',1,1,5,1,2,NULL,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":12},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":5}]'),(3,'dagent3','James','Madison','AD Agent','333-333-3333','dagent3@portal.com','USA',1,1,6,1,2,NULL,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":16},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":11}]'),(4,'dagent4','James','Monroe','AD Agent','444-444-4444','dagent4@portal.com','USA',1,1,7,1,2,NULL,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":14},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":13}]'),(5,'dagent5','John','Quincy Adams','AD Agent','555-555-5555','dagent5@portal.com','USA',1,1,8,1,2,NULL,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":8},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":5}]'),(6,'manager','John','Kennedy','Manager','000-000-0000','manager@portal.com','USA',1,1,24,2,0,NULL,NULL),(7,'admin','Marie','Charles','Manager','000-000-0000','administrator@portal.com','USA',0,0,25,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `agent_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asterisk_extensions`
--

DROP TABLE IF EXISTS `asterisk_extensions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asterisk_extensions` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `extension` int(4) DEFAULT NULL,
  `extension_secret` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asterisk_extensions`
--

LOCK TABLES `asterisk_extensions` WRITE;
/*!40000 ALTER TABLE `asterisk_extensions` DISABLE KEYS */;
INSERT INTO `asterisk_extensions` VALUES (1,6001,'_EXTENSION_PASSWORD_'),(2,6002,'_EXTENSION_PASSWORD_'),(3,6003,'_EXTENSION_PASSWORD_'),(4,33001,'_EXTENSION_PASSWORD_'),(5,33002,'_EXTENSION_PASSWORD_'),(6,33003,'_EXTENSION_PASSWORD_'),(7,33004,'_EXTENSION_PASSWORD_'),(8,33005,'_EXTENSION_PASSWORD_'),(9,33006,'_EXTENSION_PASSWORD_'),(10,33007,'_EXTENSION_PASSWORD_'),(11,33008,'_EXTENSION_PASSWORD_'),(12,33009,'_EXTENSION_PASSWORD_'),(13,33010,'_EXTENSION_PASSWORD_'),(14,33011,'_EXTENSION_PASSWORD_'),(15,33012,'_EXTENSION_PASSWORD_'),(16,33013,'_EXTENSION_PASSWORD_'),(17,33014,'_EXTENSION_PASSWORD_'),(18,33015,'_EXTENSION_PASSWORD_'),(19,33016,'_EXTENSION_PASSWORD_'),(20,33017,'_EXTENSION_PASSWORD_'),(21,33018,'_EXTENSION_PASSWORD_'),(22,33019,'_EXTENSION_PASSWORD_'),(23,33020,'_EXTENSION_PASSWORD_'),(24,0,NULL);
/*!40000 ALTER TABLE `asterisk_extensions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asterisk_operating_status`
--

DROP TABLE IF EXISTS `asterisk_operating_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asterisk_operating_status` (
  `id` int(11) NOT NULL,
  `start` varchar(8) DEFAULT '00:00',
  `end` varchar(8) DEFAULT '24:00',
  `force_off_hours` tinyint(1) DEFAULT '0',
  `business_mode` int(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asterisk_operating_status`
--

LOCK TABLES `asterisk_operating_status` WRITE;
/*!40000 ALTER TABLE `asterisk_operating_status` DISABLE KEYS */;
INSERT INTO `asterisk_operating_status` VALUES (1,'15:00','21:30',0,0);
/*!40000 ALTER TABLE `asterisk_operating_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asterisk_queues`
--

DROP TABLE IF EXISTS `asterisk_queues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asterisk_queues` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `queue_name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asterisk_queues`
--

LOCK TABLES `asterisk_queues` WRITE;
/*!40000 ALTER TABLE `asterisk_queues` DISABLE KEYS */;
INSERT INTO `asterisk_queues` VALUES (1,'ComplaintsQueue'),(2,'GeneralQuestionsQueue'),(3,'None');
/*!40000 ALTER TABLE `asterisk_queues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table 'call_block'
--

DROP TABLE IF EXISTS `call_block`;
CREATE TABLE `call_block` (
  `call_block_id` int(11) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `vrs` bigint(20),
  `admin_username` varchar(255),
  `reason` varchar(255),
  `timeUpdated` TIMESTAMP 
);

--
-- Table structure for table `outgoing_channels`
--

DROP TABLE IF EXISTS `outgoing_channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `outgoing_channels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `channel` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outgoing_channels`
--

LOCK TABLES `outgoing_channels` WRITE;
/*!40000 ALTER TABLE `outgoing_channels` DISABLE KEYS */;
INSERT INTO `outgoing_channels` VALUES (1,'SIP/7001'),(2,'SIP/7002'),(3,'SIP/7003'),(4,NULL),(5,NULL),(6,NULL),(7,NULL);
/*!40000 ALTER TABLE `outgoing_channels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scripts`
--

DROP TABLE IF EXISTS `scripts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scripts` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `queue_id` int(10) NOT NULL,
  `text` varchar(10000) NOT NULL,
  `date` date NOT NULL,
  `type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scripts`
--

LOCK TABLES `scripts` WRITE;
/*!40000 ALTER TABLE `scripts` DISABLE KEYS */;
INSERT INTO `scripts` VALUES (1,2,'Hello [CUSTOMER NAME], this is [AGENT NAME] calling from Agent Portal Services. Have I caught you in the middle of anything? The purpose for my call is to help improve our service to customers. I do not know the nature of your complaint, and this is why I have a couple of questions. How do you feel about our service? When was the last time you used our service? Well, based on your answers, it sounds like we can learn a lot from you if we were to talk in more detail. Are you available to put a brief 15 to 20 minute meeting on the calendar where we can discuss this in more detail and share any insight and value you may have to offer?','2016-04-01','Default'),(2,1,'Hello [CUSTOMER NAME], this is [AGENT NAME] calling from Agent Portal Services. I understand that you have a complaint to discuss with us?','2016-04-01','Default'),(3,1,'I see you need to change your profile information...','2017-04-04','Profile'),(4,2,'I see you need to change your profile information...','2017-04-04','Profile'),(5,1,'You are new to our system.','2017-04-04','New'),(6,2,'You are new to our system.','2017-04-04','New');
/*!40000 ALTER TABLE `scripts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_data`
--

DROP TABLE IF EXISTS `user_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_data` (
  `vrs` bigint(20) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `city` varchar(255) NOT NULL,
  `state` varchar(255) NOT NULL,
  `zip_code` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `isAdmin` tinyint(1) NOT NULL,
  PRIMARY KEY (`vrs`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7325083148 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_data`
--

LOCK TABLES `user_data` WRITE;
/*!40000 ALTER TABLE `user_data` DISABLE KEYS */;
INSERT INTO `user_data` VALUES (1111111111,'ghopper','aaa111','Grace','Hopper','1 Programming Way','Beverly Hills','CA','90210','ghopper@mail.com',0);
INSERT INTO `user_data` VALUES (2222222222,'dvaughan','aaa222','Dorothy','Vaughan','2 Programming Way','Beverly Hills','CA','90210','dvaughan@mail.com',0);
INSERT INTO `user_data` VALUES (3333333333,'mjackson','aaa333','Mary','Jackson','3 Programming Way','Beverly Hills','CA','90210','mjackson@mail.com',0);
INSERT INTO `user_data` VALUES (4444444444,'kjohnson','aaa444','Katherine','Johnson','4 Programming Way','Beverly Hills','CA','90210','kjohnson@mail.com',0);
INSERT INTO `user_data` VALUES (5555555555,'alovelace','aaa555','Ada','Lovelace','5 Programming Way','Beverly Hills','CA','90210','alovelace@mail.com',0);
INSERT INTO `user_data` VALUES (6666666666,'mmeltzer','aaa666','Marlyn','Meltzer','6 Programming Way','Beverly Hills','CA','90210','mmeltzer@mail.com',0);
INSERT INTO `user_data` VALUES (7777777777,'bholberton','aaa777','Betty','Holberton','7 Programming Way','Beverly Hills','CA','90210','bholberton@mail.com',0);
INSERT INTO `user_data` VALUES (8888888888,'katonelli','aaa888','Kathleen','Antonelli','8 Programming Way','Beverly Hills','CA','90210','kantonelli@mail.com',0);
INSERT INTO `user_data` VALUES (9999999999,'rteitelbaum','aaa999','Ruth','Teitelbaum','9 Programming Way','Beverly Hills','CA','90210','rteitelbaum@mail.com',0);
/*!40000 ALTER TABLE `user_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `videomail`
--

DROP TABLE IF EXISTS `videomail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `videomail` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `extension` varchar(16) NOT NULL,
  `recording_agent` varchar(20) DEFAULT NULL,
  `processing_agent` varchar(20) DEFAULT NULL,
  `received` timestamp NULL DEFAULT NULL,
  `processed` timestamp NULL DEFAULT NULL,
  `video_duration` smallint(5) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `deleted` tinyint(4) DEFAULT NULL,
  `src_channel` varchar(32) DEFAULT NULL,
  `dest_channel` varchar(45) DEFAULT NULL,
  `unique_id` varchar(32) DEFAULT NULL,
  `video_filename` varchar(255) DEFAULT NULL,
  `video_filepath` varchar(255) DEFAULT NULL,
  `callbacknumber` bigint(20) DEFAULT NULL,
  `deleted_time` timestamp NULL DEFAULT NULL,
  `deleted_by` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `file_uploads`
--

DROP TABLE IF EXISTS `file_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `file_uploads` (
  `pk_file_id` int(11) NOT NULL AUTO_INCREMENT,
  `original_filename` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `filepath` varchar(500) NOT NULL,
  `mimetype` varchar(40) DEFAULT NULL,
  `vrs` varchar(20) NOT NULL,
  `create_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pk_file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=913 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `call_recordings
--

DROP TABLE IF EXISTS `call_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `call_recordings` (
  `fileName` varchar(50) DEFAULT NULL,
  `agentNumber` varchar(50) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `participants` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `duration` smallint(5) DEFAULT NULL,
  `deleted` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `videomail`
--

LOCK TABLES `videomail` WRITE;
/*!40000 ALTER TABLE `videomail` DISABLE KEYS */;
/*!40000 ALTER TABLE `videomail` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Create _ACEDIRECT_DB_ and _ASTERISK_DB_ users and set appropriate permissions.

GRANT USAGE ON *.* TO '_ACEDIRECT_USER_'@'%';
DROP USER '_ACEDIRECT_USER_'@'%';
GRANT USAGE ON *.* TO '_ASTERISK_USER_'@'%';
DROP USER '_ASTERISK_USER_'@'%';

CREATE USER '_ACEDIRECT_USER_'@'%' IDENTIFIED BY '_ACEDIRECT_PASSWORD_';
CREATE USER '_ASTERISK_USER_'@'%' IDENTIFIED BY '_ASTERISK_PASSWORD_';

GRANT ALL PRIVILEGES ON _ACEDIRECT_DB_.* TO '_ACEDIRECT_USER_'@'%';
GRANT ALL PRIVILEGES ON _ASTERISK_DB_.* TO '_ASTERISK_USER_'@'%' ;
GRANT ALL PRIVILEGES ON _MEDIA_DB_.* TO '_ACEDIRECT_USER_'@'%';
GRANT SELECT ON _ASTERISK_DB_.* to '_ACEDIRECT_USER_'@'%';

FLUSH PRIVILEGES;

-- IMPORTANT!! IF USING MYSQL 8, UNCOMMENT the USE lines below.
-- This turns off strict mode so our DB operations work.
USE _ACEDIRECT_DB_; SET GLOBAL sql_mode='';
USE _ASTERISK_DB_; SET GLOBAL sql_mode='';
USE _MEDIA_DB_; SET GLOBAL sql_mode='';
