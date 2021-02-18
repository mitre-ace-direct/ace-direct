-- MySQL dump 10.14  Distrib 5.5.56-MariaDB, for Linux (x86_64)
--
-- Host: ace-direct-mysql.ceq7afndeyku.us-east-1.rds.amazonaws.com    Database: acedirectdefault
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
-- RUN THIS SCRIPT AS the root USER

-- PREREQUISITES:
-- Globally replace _EXTENSION_PASSWORD_
-- Globally replace _ACEDIRECT_PASSWORD_
-- Globally replace _ASTERISK_PASSWORD_ 
-- Globally replace _MEDIASERVER_PASSWORD_
-- Users are: acedirect , asterisk, media_server


-- create media server database

CREATE DATABASE IF NOT EXISTS media_server;

-- create fopenam databse

CREATE DATABASE IF NOT EXISTS fopenam;

-- create asterisk databse

CREATE DATABASE IF NOT EXISTS asterisk; USE asterisk;
  
CREATE TABLE `cdr` ( `calldate` datetime NOT NULL default CURRENT_TIMESTAMP, `clid` varchar(80) NOT NULL default '', `src` varchar(80) NOT NULL default '', `dst` varchar(80) NOT NULL default '', `dcontext` varchar(80) NOT NULL default '',  `channel` varchar(80) NOT NULL default '', `dstchannel` varchar(80) NOT NULL default '', `lastapp` varchar(80) NOT NULL default '', `lastdata` varchar(80) NOT NULL default '', `duration` int(11) NOT NULL default '0', `billsec` int(11) NOT NULL default '0', `disposition` varchar(45) NOT NULL default '',  `amaflags` int(11) NOT NULL default '0', `accountcode` varchar(20) NOT NULL default '', `userfield` varchar(255) NOT NULL default '', `uniqueid` VARCHAR(32) NOT NULL default '', `linkedid` VARCHAR(32) NOT NULL default '', `sequence` VARCHAR(32) NOT NULL default '', `peeraccount` VARCHAR(32) NOT NULL default '' );
  
ALTER TABLE `cdr` ADD INDEX ( `calldate` );
ALTER TABLE `cdr` ADD INDEX ( `dst` );
ALTER TABLE `cdr` ADD INDEX ( `accountcode` );


-- create acedirect database

CREATE DATABASE IF NOT EXISTS acedirect; USE acedirect;


--
-- Table structure for table `agent_data`
--

DROP TABLE IF EXISTS `agent_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agent_data` (
  `agent_id` int(10) NOT NULL AUTO_INCREMENT,
  `username` varchar(10) NOT NULL,
  `password` varchar(30) NOT NULL,
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
INSERT INTO `agent_data` VALUES (4,'dagent1','Dagent1#','John','Adams','AD Agent','444-444-4444','dagent1@portal.com','Organization Zulu',1,1,4,1,2,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":6,\"height\":13},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":12}]'),(5,'dagent2','Dagent2#','Thomas','Jefferson','AD Agent','444-444-4444','dagent2@portal.com','Organization Zulu',1,1,5,1,2,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":12},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":5}]'),(6,'dagent3','Dagent3#','James','Madison','AD Agent','444-444-4444','dagent3@portal.com','Organization Zulu',1,1,6,1,2,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":16},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":11}]'),(7,'dagent4','Dagent4#','James','Monroe','AD Agent','444-444-4444','dagent4@portal.com','Organization Zulu',1,1,7,1,2,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":14},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":13}]'),(8,'dagent5','Dagent5#','John','Quincy Adams','AD Agent','444-444-4444','dagent5@portal.com','Organization Zulu',1,1,8,1,2,'[{\"id\":\"gsvideobox\",\"x\":0,\"y\":0,\"width\":8,\"height\":8},{\"id\":\"gschatbox\",\"x\":8,\"y\":0,\"width\":4,\"height\":5}]'),(9,'dagent6','Dagent6#','Andrew','Jackson','AD Agent','444-444-4444','dagent6@portal.com','Organization Zulu',1,1,9,1,2,NULL),(10,'dagent7','Dagent7#','Martin','Van Buren','AD Agent','444-444-4444','dagent7@portal.com','Organization Zulu',1,1,10,1,2,NULL),(11,'dagent8','Dagent8#','Andrew','Johnson','AD Agent','888-888-8888','dagent8@portal.com','Organization Kilo',1,1,11,1,2,NULL),(12,'dagent9','Dagent9#','Ulysses','Grant','AD Agent','888-888-8888','dagent9@portal.com','Organization Lima',1,1,12,1,2,NULL),(13,'dagent10','Dagent10#','Rutherford','Hayes','AD Agent','888-888-8888','dagent10@portal.com','Organization Mike',1,1,13,1,2,NULL),(14,'dagent11','Dagent11#','James','Garfield','AD Agent','888-888-8888','dagent11@portal.com','Organization November',1,1,14,1,2,NULL),(15,'dagent12','Dagent12#','Chester','Arthur','AD Agent','888-888-8888','dagent12@portal.com','Organization Oscar',1,1,15,1,2,NULL),(16,'dagent13','Dagent13#','Grover','Cleveland','AD Agent','888-888-8888','dagent13@portal.com','Organization Papa',1,1,16,1,2,NULL),(17,'dagent14','Dagent14#','Benjamin','Harrison','AD Agent','888-888-8888','dagent14@portal.com','Organization Quebec',1,1,17,1,2,NULL),(18,'dagent15','Dagent15#','William','McKinley','AD Agent','888-888-8888','dagent15@portal.com','Organization Romeo',1,1,18,1,2,NULL),(19,'dagent16','Dagent16#','Theodore','Roosevelt','AD Agent','888-888-8888','dagent16@portal.com','Organization Sierra',1,1,19,1,2,NULL),(20,'dagent17','Dagent17#','William','Taft','AD Agent','888-888-8888','dagent17@portal.com','Organization Tango',1,1,20,1,2,NULL),(21,'dagent18','Dagent18#','Woodrow','Wilson','AD Agent','888-888-8888','dagent18@portal.com','Organization Uniform',1,1,21,1,2,NULL),(22,'dagent19','Dagent19#','Warren','Harding','AD Agent','888-888-8888','dagent19@portal.com','Organization Victor',1,1,22,1,2,NULL),(23,'dagent20','Dagent20#','Calvin','Coolidge','AD Agent','888-888-8888','dagent20@portal.com','Organization Whiskey',1,1,23,1,2,NULL),(24,'manager','manager1234','George','Washington','Manager','000-000-0000','manager@portal.com','Organization Zulu',1,1,24,2,0,NULL),(25,'admin','Admin1#','Marie','Charles','Manager','444-444-4444','administrator@portal.com','Organization Zulu',0,0,25,0,NULL,NULL);
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
INSERT INTO `asterisk_extensions` VALUES (1,6001,'_EXTENSION_PASSWORD_'),(2,6002,'_EXTENSION_PASSWORD_'),(3,6003,'_EXTENSION_PASSWORD_'),(4,30001,'_EXTENSION_PASSWORD_'),(5,30002,'_EXTENSION_PASSWORD_'),(6,30003,'_EXTENSION_PASSWORD_'),(7,30004,'_EXTENSION_PASSWORD_'),(8,30005,'_EXTENSION_PASSWORD_'),(9,30006,'_EXTENSION_PASSWORD_'),(10,30007,'_EXTENSION_PASSWORD_'),(11,30008,'_EXTENSION_PASSWORD_'),(12,30009,'_EXTENSION_PASSWORD_'),(13,30010,'_EXTENSION_PASSWORD_'),(14,30011,'_EXTENSION_PASSWORD_'),(15,30012,'_EXTENSION_PASSWORD_'),(16,30013,'_EXTENSION_PASSWORD_'),(17,30014,'_EXTENSION_PASSWORD_'),(18,30015,'_EXTENSION_PASSWORD_'),(19,30016,'_EXTENSION_PASSWORD_'),(20,30017,'_EXTENSION_PASSWORD_'),(21,30018,'_EXTENSION_PASSWORD_'),(22,30019,'_EXTENSION_PASSWORD_'),(23,30020,'_EXTENSION_PASSWORD_'),(24,0,NULL);
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
  `business_mode` int(1) DEFAULT NULL,
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
  `timeUpdated` datetime
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
  `create_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pk_file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=913 DEFAULT CHARSET=utf8;
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

-- Create acedirect and asterisk users and set appropriate permissions.
-- For security, the acedirect user only gets read access to the CDR table.

CREATE USER 'acedirect'@'%' IDENTIFIED BY '_ACEDIRECT_PASSWORD_';
CREATE USER 'asterisk'@'%' IDENTIFIED BY '_ASTERISK_PASSWORD_';
CREATE USER 'media_server'@'%' IDENTIFIED BY '_MEDIASERVER_PASSWORD_'; 

GRANT ALL PRIVILEGES ON acedirect.* TO 'acedirect'@'%';
GRANT ALL PRIVILEGES ON asterisk.* TO 'asterisk'@'%' ;
GRANT ALL PRIVILEGES ON media_server.* TO 'media_server'@'%';
GRANT SELECT ON asterisk.* to 'acedirect'@'%';

FLUSH PRIVILEGES;

