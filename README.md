# 📘 Mainframe DB2 Project

## 📌 Project Overview
This project is a Mainframe-based application developed using COBOL, JCL, and IBM DB2. It is designed to handle secure, high-volume data processing and efficient database management in a mainframe environment.

The system performs:
* Batch data processing using JCL
* Business logic execution using COBOL programs
* Data storage, retrieval, and manipulation using DB2

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| COBOL | Business logic implementation |
| JCL (Job Control Language) | Job execution and batch processing |
| IBM DB2 | Database storage and querying |
| TSO/ISPF | Development environment |
| SPUFI / QMF | DB2 query execution |

## 📂 Project Structure

```
project-root/
│
├── cobol/                # COBOL source programs
├── jcl/                  # JCL scripts for execution
├── copybooks/            # Copybook files used by COBOL programs
├── db2/
│   ├── ddl/              # DB2 table creation scripts
│   ├── dml/              # Insert/update/select queries
│   └── bind/             # DB2 bind packages
├── data/                 # Input and output data files
└── docs/                 # Project documentation
```

## ⚙️ System Requirements
To run this project, you need:
* Access to IBM Mainframe (z/OS)
* TSO/ISPF access
* DB2 subsystem
* COBOL Compiler installed
* JCL execution privileges

## 🗄️ DB2 Database Setup

### 1. Create Tables
Run the DDL scripts from:
```
/db2/ddl/
```

Example:
```sql
CREATE TABLE CUSTOMER (
    CUSTOMER_ID     INTEGER NOT NULL,
    CUSTOMER_NAME   VARCHAR(100),
    ACCOUNT_BALANCE DECIMAL(10,2),
    PRIMARY KEY (CUSTOMER_ID)
);
```

### 2. Insert Sample Data
```sql
INSERT INTO CUSTOMER VALUES (1, 'Shravani', 5000.00);
INSERT INTO CUSTOMER VALUES (2, 'Amit', 7500.50);
```

### 3. Bind DB2 Programs
Bind the DBRM using:
```jcl
//BINDJOB  JOB ...
//STEP1    EXEC PGM=IKJEFT01
//SYSTSIN  DD *
  DSN SYSTEM(DB2SUB)
  BIND PACKAGE(package_name) MEMBER(member_name)
  END
/*
```

## ▶️ How to Run the Project

### Step 1: Compile COBOL Program
Use JCL to compile:
```jcl
//COMPILE EXEC PGM=IGYWCL
//COBOL.SYSIN DD DSN=YOUR.COBOL.SOURCE,DISP=SHR
```

### Step 2: Link & Bind
Link-edit and bind DB2 modules using standard JCL procedures.

### Step 3: Execute Job
Run the JCL from `/jcl/` folder:
```jcl
//RUNJOB EXEC PGM=YOURPROGRAM
//STEPLIB DD DSN=LOAD.LIBRARY,DISP=SHR
```

### Step 4: Check Output
* SYSOUT
* Output dataset
* DB2 table updates

## 🔁 Data Flow

```
Input File → JCL Job → COBOL Processing → DB2 Interaction → Output File
```

## 🔐 Features
* High performance batch processing
* Secure DB2 transactions
* Error handling and logging
* Scalable for large datasets
* Structured modular design

## 🧪 Testing
Test cases include:
* Valid input processing
* Invalid data handling
* DB2 transaction validation
* Boundary conditions

## 🧑‍💻 Developer Guide

### Coding Standards
* COBOL structured programming
* Meaningful variable naming
* Modular paragraph usage
* DB2 SQL embedded statements

## 🚀 Deployment
1. Move Load modules to Production Load Library
2. Update DB2 Bind Packages
3. Schedule JCL in Production Scheduler
4. Monitor execution logs

## 📈 Future Enhancements
* Add CICS online transaction interface
* Integrate REST APIs
* Enhance reporting modules
* Add automation monitoring

