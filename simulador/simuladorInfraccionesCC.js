var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var InfraccionesJssm = require('../maquinas/infraccionJssmImpl');
var Steper = require('../Steper');

var steper = new Steper(process.argv[2]);

var infraccionesDB = new Array();
var infraccion;

var MonitorServer = require('../monitorServer');
var monitor = new MonitorServer(steper,infraccionesDB);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'infracciones';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      infraccion = _.find(infraccionesDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!infraccion) {
        console.log('simuladorInfraccionesCC: ingresa a nueva infraccion');
        infraccion = new InfraccionesJssm();
        infraccion.compra = evento.data;
        infraccionesDB.push(infraccion);
      }

      steper.emit('step',infraccion,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6001, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});
