# OBusyLight

An OpenJDK/FX version of the BusyLight server app

## Prerequisites

* macOS or Windows OS 64-bit
* Terminal (macOS) or [Git Bash](https://git-scm.com/download/win) (Windows)

## Remove Oracle Java versions

### Mac users

Open a _Terminal_ window and execute the following commands:

```bash
$  sudo rm -fr /Library/Internet\ Plug-Ins/JavaAppletPlugin.plugin
$
$  sudo rm -fr /Library/PreferencePanes/JavaControlPanel.prefPane 
$  sudo rm -fr ~/Library/Application\ Support/Oracle/Java
$  sudo rm -r ~/"Library/Application Support/Oracle/Java"
$  cd /Library/Java/JavaVirtualMachines
$  sudo rm -rf jdk-10.0.2.jdk  # repeat for any other JDK
```

### Windows users

* Open the _Add or remove programs_ window
* Sort by _Publisher_ *Oracle Corporation*
* Uninstall/remove all programs for _Java_

## Install Maven

* Download from [https://maven.apache.org/download.cgi](https://maven.apache.org/download.cgi)
* Download the Binary zip archive, for example: *apache-maven-3.6.1-bin.zip*
* Extract the zip file and copy the extracted folder, for example *apache-maven-3.6.1* to your *home* folder
* In your `~/.bash_profile` file, add the `MAVEN_HOME` environment variable. For example, if you are user `mjones`:

    ```bash
    # On Mac...
    MAVEN_HOME=/Users/mjones/apache-maven-3.6.1

    # On Windows...
    MAVEN_HOME=/c/Users/mjones/apache-maven-3.6.1
    ```

## Install OpenJDK

* Download and extract OpenJDK 11 LTS:

  * Visit [OpenJDK 11 LTS](https://adoptopenjdk.net/?variant=openjdk11&jvmVariant=hotspot)
  * Select the Version: _OpenJDK 11(LTS)_
  * Select the JVM: _HotSpot_
  * Click _Latest release_ to download the file.
  * Click *Download JDK* and download _macOS x64_ (Mac) or _Windows x64_ (Windows).
  * Extract the downloaded ZIP file

* Copy the extracted folder to another location, for example:

  * On Mac, copy *jdk-11.0.3+7* to `/Library/Java/JavaVirtualMachines/`
  * On Windows, copy *jdk-11.0.3+7* to your home folder

* Add/update Java environment variables in `~/.bash_profile`, for example:

    ```bash
    # On Mac...
    JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-11.0.3+7/Contents/Home

    # On Windows, if you are mjones...
    JAVA_HOME=/c/Users/mjones/jdk-11.0.3+7

    # Both platforms
    JDK_HOME=$JAVA_HOME
    JRE_HOME=$JAVA_HOME/bin
    ```

## Install OpenFX

OpenFX is the open source version of JavaFX:

* Go to [https://gluonhq.com/products/javafx/](https://gluonhq.com/products/javafx/).
* Download _JavaFX SDK_ for your platform.
* Extract the ZIP files to your home folder. For example, for user `mjones` on macOS: `/Users/mjones/javafx-sdk-11.0.2`
* Add an environment variables in `~/.bash_profile`:

    ```bash
    # On Mac...
    OPENFX_SDK=/Users/mjones/javafx-sdk-11.0.2

    # On Windows, if you are mjones...
    OPENFX_SDK=/c/Users/mjones/javafx-sdk-11.0.2
    ```

## Update CLASSPATH variable

In `~/.bash_profile` add/update the CLASSPATH variable:

```bash
CLASSPATH=.:$JAVA_HOME/lib:$OPENFX_SDK/lib
```

## Update PATH variable

The PATH environment variable indicates where executable programs are. In the `~/.bash_profile` file, add the Maven and Java `bin` folders to the `PATH` variable:

```bash
PATH=${JAVA_HOME}/bin:${MAVEN_HOME}/bin:${PATH}
```

## Export all environment variables

Finally, in `~/.bash_profile`, export all the environment variables:

```bash
export JAVA_HOME JDK_HOME JRE_HOME OPENFX_SDK CLASSPATH PATH
```

## Proxy settings

If you are running inside a corporate network, set proxies in `~/.m2/settings.xml`.

## Verify tools

Open a Terminal (Mac) or Git Bash window (Windows), then execute these commands:

```bash
$  source ~/.bash_profile
$
$  # you should see version output for the next three commands
$  java -version   
$  javac -version
$  mvn -version
```

## Building and running the project

* Clone this repo to your computer
* **Plug in a BusyLight device to a USB port on your computer** (make sure it lights up briefly)
* Run this project, following one of the three methods below.

### VS Code

* Start _VS Code_
* Open this folder: File > Open... > obusylight
* Terminal > New Terminal
* From the Terminal, go to this folder: `cd obusylight`
* Source the environment: `source ~/.bash_profile`
* Run the project: `mvn clean javafx:run`
* Build the executable JAR: `mvn clean install assembly:single package`

### Terminal

```bash
$  cd obusylight
$
$  ./run.sh
$
$ # Or...
$  source ~/.bash_profile
$  mvn clean javafx:run  # run it this way
$  mvn clean install assembly:single package  # build the executable jar
```

### Eclipse

* File > Import... > Maven > Existing Maven Projects
* Navigate to `obusylight`
* Right-click project > Run As... > Maven build...
* Goal - Run from Eclipse: `clean javafx:run`
* Goal - Build executable JAR: `mvn clean install assembly:single package`
* Run

### Running the JAR file

```bash
$  cd obusylight
$
$  source ~/.bash_profile  # ensure environment vars
$  java --module-path ${OPENFX_SDK}/lib --add-modules=javafx.controls -jar target/obusylight-1.0-jar-with-dependencies.jar
```

_End._
