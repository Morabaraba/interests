## PostgreSQL + Erlang

### erlang.mk

Create a `Makefile`, see the erlang.mk [getting started guide](https://erlang.mk/guide/getting_started.html).
```make
PROJECT = example1
DEPS = epgsql
include erlang.mk
```

### repl

Start your PostgreSQL Server and open up your erl [repl](http://erlang.org/doc/man/erl.html)(read–eval–print loop) by typing `make run` in your terminal.  Make sure `epgsql` is loaded by running.
```erl
m(epgsql).
```
if it loads successfully you will see the module's information.
To connect to our database run.

```erl
{ok, Connection} = epgsql:connect("<hostname>", "<username>", "<password>", [{database, "<dbname>"}]).
```
This will return a connection that we can then use to interact with the database.
Create a table by running the following Simple Query.
```erl
{ok, [], []} = epgsql:squery(Connection, 
    "CREATE TABLE IF NOT EXISTS event (_id TEXT PRIMARY KEY, at TIMESTAMP, meta JSONB);").
```
Now to insert data into our database run.
```erl
{ok, 1} = epgsql:squery(Connection, 
    "INSERT INTO event (_id, at, meta) VALUES ('postgres+erlang+rocks', now(), '{\"learning\": \"Welcome to Erlang and PostgreSQL.\"}'::JSONB);").
```
This returns `{ok, N}`, where N is the number of rows inserted.  Lets go head and add two more items into our database.
```erl
{ok, 2} = epgsql:squery(Connection, "INSERT INTO event (_id, at, meta) VALUES ('blank meta', now(), NULL), ('blank meta', now(), '{}') ;").
```
In order to query our database we can also use a Simple Query.
```erl
{ok, Cols, Rows} =  epgsql:squery(Connection, "SELECT * FROM event;").
```
This will return all the data in the row as binary data.
In order to get data returned typed correctly we need to use an extended query:
```erl
{ok, Cols, Rows} =  epgsql:equery(Connection, "SELECT * FROM event;").
```
That's how you can connect to and get data in and out of a Postgres database using Erlang.

Now lets close the connection by running
```erl
epgsql:close(Connection).
```

Original article by Reza Nikoopour can be found [here][org].

[org]: http://www.nikoopour.com/2016/05/postgres-erlang-on-osx-part-2.html      


### Cowboy web sockets

We will wrap our queries around cowboy web socket handlers. 

To get up and running with cowboy web sockets look at the [example][cowboy web socket example]

[cowboy web socket example]: https://github.com/ninenines/cowboy/tree/master/examples/websocket

I git cloned cowboy

`git clone git@github.com:ninenines/cowboy.git`

and `make run` the example.


#### TODO

- Pooling of pg connection
- Implement select and insert(sanitize inputs) into pg
- Implement notice to client via web sockets

<div class="u-pull-left">
&#8656; [Introduction]
</div> 
<div class="u-pull-right">
[frameworks] &#8658;
</div>
<br>

[Index]: ?md/index.md
[Introduction]: ?md/intro.md
[Real Time Aggregation(PostgreSQL)]: ?md/try-citus.md
[Erlang and PostgreSQL(epgsql)]: ?md/erlang+epgsql.md
[frameworks]: ?md/framework.md
[System(*nix)]: ?md/nix.md