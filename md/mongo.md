

## Tales from the Trenches - the New MongoDB FDW
### By Jason Davis, Jul 24, 2014

[*This blog was co-written by Ahsan Hadi and Ibrar Ahmed.*](http://www.enterprisedb.com/postgres-plus-edb-blog/jason-davis/tales-trenches-new-mongodb-fdw)

Postgres provides a powerful feature called Foreign Data Wrappers (FDW) which 
enables DBAs to use the system as a single integration point to read, analyze and 
write to data from many remote data stores.  C developers can create new 
Foreign Data Wrappers using the hooks exposed by the database, and many FDWs 
have been published in the Open Source community.

Postgres’ FDW implementation is based on SQL/MED (SQL Management of External Data), 
which was introduced in 2011 in PostgreSQL 9.1 and has been incrementally improved 
upon in recent Postgres releases. Most recently, PostgreSQL 9.3 added the ability 
for FDWs to support write capabilities.

EnterpriseDB has undertaken the work to improve the FDWs for some of the 
database solutions customers have begun to explore, beginning with MongoDB. 
The new Foreign Data Wrapper helps break down data silos resulting from 
MongoDB deployments by integrating the data with the enterprise 
database management system. This provides a seamless experience for realizing 
greater meaning from wider data sets and eases data governance problems.

Given the popularity of FDWs and the drive among the open source community to 
develop them, EDB has released to the community a new FDW for the document 
database MongoDB and will soon release one for Hadoop.

As we started to research developing a Foreign Data Wrapper for Mongo, 
we discovered the Mongo_FDW work our friends from CitusData initiated and 
released under the LGPL License.

This version was based on the Postgres 9.1 spec and did not feature the 
capabilities newly made possible. We decided to fork the repository and 
target our enhancements in three key areas. First, we made use of the new 9.3 
feature by adding writability support. Second, we saw that the FDW could benefit 
from the implementation of a connection pooler. Finally, we decided to add an 
option to use the new MongoDB Meta Driver as opposed to a Legacy driver given 
recent recommendations from MongoDB developers.

#### Implementing Write Capabilities

The first enhancement was to provide support for INSERT/UPDATE/DELETE statements 
by making the FDW writeable.  We faced two main challenges in implementing this
writeability feature.

The first challenge was to figure out the unique id in a table, because the 
DELETE and UPDATE statements require a row identifier to delete or 
update one row at a time. There are multiple mechanisms used in different 
FDWs that we examined for reference:

The Postgres FDW uses ctid to identify a unique foreign row, but this 
is limited to just Postgres sources.
The Hadoop FDW uses the first column as a key / rowid column and this must be 
unique.
The Oracle FDW requires you to specify a key / rowid column while creating a 
table as an option, (i.e. specifying "KEY = 2" makes column 2 the row identifier).
We decided to follow mechanics similar to the Hadoop FDW, making the 
first column as the row identifier and mapping it to MongoDB's "_id" column.

The second challenge we faced was how to insert the "_id" field in MongoDB database.  
There are three ways we could have chosen to do that:

Let MongoDB insert it without making the field visible in the Foreign Table.
Have the first field "_id" mandatory and let the user to insert that field.
Have the first field "_id" mandatory and let Mongo insert it, 
ignoring any values the user specifies in the foreign table.
In our implementation, we used the third option, because it allows the DBA to
view the _id value assigned by Mongo in Postgres and requires no extra effort 
on behalf of the user to insert that field.

#### Performance Booster

The second enhancement we made was to add the connection manager / pooler.  In 
the previous MongoDB FDW implementation, the FDW established multiple connections 
to the MongoDB deployment in a single query and did not reuse any of the 
existing connections. Under certain situations, this portion of the code could 
be the cause of some performance bottlenecks. To alleviate this, we introduced 
a connection manager in the Foreign Data Wrapper, which establishes one connection 
per session. It then reuses the same connection not only within the context of 
a single query, but also across all queries of that session. This has provided 
a good performance boost.

#### Shoring Up MongoDB Data Stability

The third enhancement was to add support for the new MongoDB C Driver based on 
their new meta- river library. The CitusData FDW implementation is based on the 
legacy driver for MongoDB, and in recent releases, the MongoDB team has been 
working on a completely new driver library to formalize the specification of the 
client library interfaces.  As a result, we have added support of that driver 
with a compile time option that allows you to use the legacy or new mongo-c-driver.  
There are additional benefits of the new mongo-c-driver that we will look to 
adopt as we learn more and gather new real world use cases.

#### MongoDB FDW in Action

Our new fork of the MongoDB FDW is readable and writable and based on the 
Postgres 9.3 specification. It will make it easy to manipulate data in MongoDB 
data using simple SQL statements (SELECT / INSERT / UPDATE / DELETE).  

The FDW can be downloaded from EDB’s Github repository here.

Following are some examples of using the mongo_fdw with the MongoDB equivalent statements.

```sql
-- load extension first time after install
CREATE EXTENSION mongo_fdw;

-- create server object
CREATE SERVER mongo_server
FOREIGN DATA WRAPPER mongo_fdw
OPTIONS (address '127.0.0.1', port '27017');

-- create user mapping
CREATE USER MAPPING FOR Postgres
SERVER mongo_server
OPTIONS (username 'mongo_user', password 'mongo_pass');

-- create foreign table (Note: first column of the table must be "_id" of type "NAME".)
CREATE FOREIGN TABLE warehouse(
_id NAME,
warehouse_id int,
warehouse_name text,
warehouse_created timestamptz)
SERVER mongo_server
OPTIONS (database 'db', collection 'warehouse');

-- select from table
SELECT * FROM warehouse WHERE warehouse_id = 1;
_id          | warehouse_id | warehouse_name | warehouse_created
------------------------+----------------+--------------------------- 53720b1904864dc1f5a571a0|            1 | UPS            | 12-DEC-14

12:12:10 +05:00

-- corresponding find statement in MongoDB db.warehouse.find({"warehouse_id" : 1}).pretty()
{
"_id" : ObjectId("53720b1904864dc1f5a571a0"),
"warehouse_id" : 1,
"warehouse_name" : "UPS",
"warehouse_created" : ISODate("2014-12-12T07:12:10Z")
}

-- insert row in table
INSERT INTO warehouse values (0, 1, 'UPS', to_date('2014-12-12T07:12:10Z'));

-- corresponding insert statement in MongoDB
db.warehouse.insert (
{
"warehouse_id" : NumberInt(1),
"warehouse_name" : "UPS",
"warehouse_created" : ISODate("2014-12-12T07:12:10Z")
})

-- delete row from table
DELETE FROM warehouse where warehouse_id = 3;

-- corresponding delete statement in MongoDB db.warehouse.remove(
{ "warehouse_id" : 3
})

-- update a row of table
UPDATE warehouse set warehouse_name = 'UPS_NEW' where warehouse_id = 1;

-- corresponding update statement in MongoDB db.warehouse.update (
{       "warehouse_id" : 1    },
{
"warehouse_id" : 1,
"warehouse_name" : "UPS_NEW"
} )

-- explain a table
EXPLAIN SELECT * FROM warehouse WHERE warehouse_id = 1; QUERY PLAN
-----------------------------------------------------------------  
Foreign Scan on warehouse  (cost=0.00..0.00 rows=1000 width=44) Filter: (warehouse_id = 1)
Foreign Namespace: db.warehouse
Planning time: 0.671 ms (4 rows)

-- collect data distribution statistics`
ANALYZE warehouse;
```

Jason Davis is Director, Product Manager at EnterpriseDB. Ahsan Hadi is Director Product Development and Ibrar Ahmed is a Technical Architect at EDB.    

Tags: DBAs, foreign data wrappers, MongoDB, NoSQL, JSON, key-value, HStore, open source, Postgres (PostgreSQL)
