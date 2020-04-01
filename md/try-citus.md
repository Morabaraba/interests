# Real Time Aggregation

Real Time Aggregation is vital to any organization.

I quickly want to take you through some testing I did recently.

You will need PostgreSQL. I'm interested in CitusDB so I used their
easy to install tar [linux package][try-citus] to play around with clusters. The 
[instructions][try-citus] is on their website. After creating your cluster you 
can follow the [Real Time Aggregation] article. To see it in in action with the 
Wikipedia via Web Sockets, using their live feed. 

Just think how you can aggregate it, mine it, in real time.

I would also recommend you read up about HyperLogLog. A good implementation of 
example is the [data warehouse use case]. Google also have a [research paper][google hll]
about hhl.

[data warehouse use case]: https://github.com/aggregateknowledge/postgresql-hll#data-warehouse-use-case
[google hll]: http://static.googleusercontent.com/external_content/untrusted_dlcp/research.google.com/en/us/pubs/archive/40671.pdf
[Real Time Aggregation]: (https://www.citusdata.com/docs/citus/5.0/tutorials/tut-real-time.html#tut-real-time)
[try-citus]: https://www.citusdata.com/docs/citus/5.0/installation/single_node_linux.html

## HyperLogLog

We clone the PostgreSQL HyperLogLog extension `git clone git@github.com:aggregateknowledge/postgresql-hll.git`

`make` it against our try-citus postgresql. On my c9 box it was

`PG_CONFIG=/home/ubuntu/workspace/try-citus/bin/pg_config make`

After it compiled `hhl.so` successfully install it by copying the extension

```sh
cp hll.so /home/ubuntu/workspace/try-citus/lib/postgresql/
cp hll.control hll--2.10.0.sql /home/ubuntu/workspace/try-citus/share/postgresql/extension/
```

### Wikipedia Aggregate Examples

Remember the citus wikipedia example

```sql
ubuntu=# \d wikipedia_edits
          Table "public.wikipedia_edits"
   Column   |           Type           | Modifiers 
------------+--------------------------+-----------
 time       | timestamp with time zone | 
 editor     | text                     | 
 bot        | boolean                  | 
 wiki       | text                     | 
 namespace  | text                     | 
 title      | text                     | 
 comment    | text                     | 
 minor      | boolean                  | 
 type       | text                     | 
 old_length | integer                  | 
 new_length | integer                  | 
 meta       | jsonb                    | 
 ```
 
We going to copy the hll example from the use case, and modify it a bit; Into our wikipedia db. 

We need to massage our data a bit.

```sql
CREATE TABLE wikipedia_daily_edits AS (
    SELECT time::DATE as date, editor, count(1) FROM wikipedia_edits GROUP BY 1, 2
);
```

On the `wikipedia_edits` it took me `46069.377 ms`. Please do not use it as a 
performance stat. I'm running this in a small vm. 

Now let us create our `daily_uniques` from our `wikipedia_daily_edits` table.

```sql
CREATE EXTENSION hll;

-- Create the destination table
CREATE TABLE daily_uniques (
    date            date UNIQUE,
    editors           hll
);

-- Fill it with the aggregated unique statistics
INSERT INTO daily_uniques(date, editors)
    SELECT time, hll_add_agg(
        hll_hash_text(editor, 123/*hash seed*/)
    )
    FROM wikipedia_daily_edits
    GROUP BY 1;

-- Time: 132.586 ms

```

Our `user_id` is the unique `editor` name so I'm just using going to use `hll_hash_text`
with a constant seed of 123.

Now we can answer "How many unique editors did I see each day?"

```sql
ubuntu=# SELECT date, hll_cardinality(editors) FROM daily_uniques order by date desc;
```

What if you wanted to this week's uniques?

```sql
SELECT hll_cardinality(hll_union_agg(editors)) FROM daily_uniques WHERE date >= '2012-01-02'::date AND date <= '2012-01-08'::date;
```

Or the monthly uniques for this year?

```sql
SELECT EXTRACT(MONTH FROM date) AS month, hll_cardinality(hll_union_agg(editors))
FROM daily_uniques
WHERE date >= '2012-01-01' AND
      date <  '2013-01-01'
GROUP BY 1;
```

Or how about a sliding window of uniques over the past 6 days?

```sql
SELECT date, #hll_union_agg(editors) OVER seven_days
FROM daily_uniques
WINDOW seven_days AS (ORDER BY date ASC ROWS 6 PRECEDING);
```

Or the number of uniques you saw yesterday that you didn't see today?

``` sql
SELECT date, (#hll_union_agg(editors) OVER two_days)
FROM daily_uniques
WINDOW two_days AS (ORDER BY date ASC ROWS 1 PRECEDING);
```

### Alternative Method

We can also create a table onto the cluster that acts like a view.

```sql

## editor_count

-- initial create
CREATE TABLE editor_count AS (SELECT editor, count(1) FROM wikipedia_edits GROUP BY 1 ORDER BY count(1) DESC);

-- recreating the view
BEGIN;
CREATE TABLE prepare_editor_count AS (SELECT editor, count(1) AS total_edit FROM wikipedia_edits GROUP BY 1 ORDER BY count(1) DESC);
DROP TABLE IF EXISTS editor_count;
ALTER TABLE prepare_editor_count RENAME TO editor_count;
COMMIT;

```

Creation and recreation will take seconds or minutes depending on your data size. But it should scale over some clusters, disk usage is a concern.

### Note on the Table Views*

The above example was sourced from the [pg_shard forum][0].

#### Forum Example

If you want to create a local materialized view from a distributed table on the master node then you can use a table instead:

`CREATE TABLE testmview AS select * from github_events where event_id=2489368089;`

In this case to refresh the view you could to do something like this:

```sql
BEGIN;
CREATE TABLE prepare_view AS select * from github_events where event_id=2489368089;
DROP TABLE IF EXISTS testmview;
ALTER TABLE prepare_view RENAME TO testmview;
COMMIT;
```

This does come at the expense of more storage usage.

[0]: https://groups.google.com/forum/#!topic/pg_shard-users/h7uPnn4RiJI

<div class="u-pull-left">
&#8656; [Introduction]
</div> 
<div class="u-pull-right">
[Visualization and Frameworks] &#8658;
</div>
<br>

[Index]: ?md/index.md
[Introduction]: ?md/intro.md
[Real Time Aggregation(PostgreSQL)]: ?md/try-citus.md
[Visualization and Frameworks]: ?md/framework.md
[Erlang and PostgreSQL(epgsql)]: ?md/erlang+epgsql.md