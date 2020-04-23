# Introduction

Do you use `sqlalchemy` or `flask-admin` and want to track orm insert/update events with [zabbix](https://github.com/zabbix/zabbix-docker#what-is-zabbix)? 

Well bellow is some code snippets and templates to get you started.

# Rational

Their is none, the idea popped in my head while taking a shower and i decided to implement it to see what will happen. It is influenced by a recent talk I attended on event stores(cqrs) in postges, but my hack just sends the data and hope the zabbix server is listening and configured correctly.

# Low Level Discovery of SQLA Tables

Here we use [py-zabbix](https://pypi.org/project/py-zabbix/ ) and some python code to look at our [sqlalchemy metatables](https://docs.sqlalchemy.org/en/13/core/metadata.html) and trap zabbix data. For each sqlalchemy table we create a `{#ENTITY_NAME}` macro that will create a host in zabbix. 

Then for each host(`{#ENTITY_NAME}`) we iterate over it columns and create a `{ITEM_NAME}` macro that will create item(s)/columns for each host.

You will also need to import the `Entity LLD Template` into your zabbix server. I tested with zabbix 3.4 and modified the exported template by hand to import into zabbix 3.2, here be dragons.

- [zbx_Entity_LLD_Template_3.4.xml](https://gist.github.com/Morabaraba/0027b42d090694f857bfa347c2feb6cd#file-zbx_entity_lld_template_3-4-xml)
- [zbx_Entity_LLD_Template_3.2.xml](https://gist.github.com/Morabaraba/0027b42d090694f857bfa347c2feb6cd#file-zbx_entity_lld_template_3-2-xml)

In our example below we default our zabbix host with the discovery rules attached to `ZABBIX_LLD_HOSTNAME = 'template-lld'` so you will need to create the host in zabbix and attach the `Entity LLD Template` you imported into your zabbix server.

```py
from flask import current_app as app
from pyzabbix import ZabbixMetric, ZabbixSender

from core import db # flask-sqlalchemy

def entity_discovery():
	servername = app.config.get('ZABBIX_SERVER', False)
	serverport = app.config.get('ZABBIX_SERVER_PORT', 10051)
	
	if not servername:
		return # no zabbix server to report to
	
	data = { 'data': [ ] } # zabbix lld wants its macro data in a array
	table_data = {}
	
	for table in db.metadata.tables:
		data['data'].append({ '{#ENTITY_NAME}': table } )
		table_data[table] = { 'data': [ ] }
		for col in db.metadata.tables[table].columns:
			table_data[table]['data'].append({ '{#ITEM_NAME}': col.name } )
			
	hostname = app.config.get('ZABBIX_LLD_HOSTNAME', 'template-lld') # remember to create the host that will create our lld hosts	
	packet = [ ZabbixMetric(hostname, 'entity.discovery', json.dumps(data)), ] 
	try:		
		result = ZabbixSender(servername, serverport).send(packet) # Send metrics to zabbix trapper	
		app.logger.debug(result)
	except Exception as err:
		app.logger.error(err)
	
	for hostname, data in table_data.items():		
		packet = [ ZabbixMetric(hostname, 'entity.discovery', json.dumps(data)), ] 
		try:			
			result = ZabbixSender(servername, serverport).send(packet) # Send metrics to zabbix trapper
			app.logger.debug(result)
		except Exception as err:
			app.logger.error(err)
```

I normally attach a [`@app.cli.command()`](http://flask.pocoo.org/docs/1.0/cli/#custom-commands) decorator to `entity_discovery` to call it from the cli as I change my models. You need to run this function at least twice to create the hosts and make sure all the items is created. Before zabbix will accept your orm event listeners as seen below.

# Zabbix Trap of SQLA ORM Events

Now in our flask-admin sqlalchemy orm we attach onto our orm event [`after_update`](https://docs.sqlalchemy.org/en/13/orm/events.html#sqlalchemy.orm.events.MapperEvents.after_update) and `after_insert`.

```py
from sqlalchemy import orm, event

def sqla_event_listener(mapper, connection, target):
	servername = app.config.get('ZABBIX_SERVER', False)
	serverport = app.config.get('ZABBIX_SERVER_PORT', 10051)
	use_sqla_event = app.config.get('ZABBIX_USE_SQLA_EVENT_LOGGING', False)
	if not servername and not use_sqla_event:
		return # no zabbix server to report to
	hostname = target.__table__.name # our event_discovery lld created these hosts in zabbix
	packet = []
	for col in mapper.columns:
		packet.append(ZabbixMetric(hostname, f'column[{col.name}]', getattr(target, col.name, None) ))
	try:		
		result = ZabbixSender(servername, serverport).send(packet)
		app.logger.debug(result)
	except Exception as err:
		app.logger.error(err)

event.listen(<SQLAModel>, 'after_update', sqla_event_listener) 
event.listen(<SQLAModel>, 'after_insert', sqla_event_listener) # link the sqla_event_listener method to your SQLAlchemy models
```

# Over engineered 

This is definitely over engineered and more a proof of concept. I actually never touched
[cqrs](http://cqrs.wikidot.com/doc:event-sourcing ) or
 [event storage](https://dev.to/kspeakman/event-storage-in-postgres-4dk2 ) but I am amazed how easily I can use zabbix to recreate my database orm model using lld and then start to trap/stream data to it as a user interact with my flask application.

Also rather to have this in my application layer I want to use [pg_notify](https://www.postgresql.org/docs/current/sql-notify.html ) and [pg-amqp-bridge](https://github.com/subzerocloud/pg-amqp-bridge ) to listen to these events as in the event storage example using triggers but then use [mqttwarn](https://github.com/jpmens/mqttwarn/wiki/zabbix) to send it to zabbix, but wip.

_What do you think?_
