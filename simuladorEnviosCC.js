var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;
var _ = require("underscore");
var EnviosJssm = require('./enviosJssmImpl');
var Steper = require('./Steper');

var steper = new Steper(process.argv[2]);

var enviosDB = new Array();
var envio;

var MonitorServer = require('./monitorServer');
var monitor = new MonitorServer(steper,enviosDB);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'envios';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      envio = _.find(enviosDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!envio) {
        console.log('simuladorEnviosCC: ingresa un nuevo envio');
        envio = new EnviosJssm();
        envio.compra = evento.data;
        enviosDB.push(envio);
      }

      steper.emit('step',envio,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6005, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});
