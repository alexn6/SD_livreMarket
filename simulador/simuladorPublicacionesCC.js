var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var PublicacionesJssm = require('../maquinas/publicacionesJssmImpl');
var Steper = require('../Steper');

var steper = new Steper(process.argv[2]);

var PublicacionesDB = new Array();
var publicacion;

var MonitorServer = require('../monitorServer');
var monitor = new MonitorServer(steper,PublicacionesDB);

// var SimuladorPublicaciones = function (modo) {

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'publicaciones';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      publicacion = _.find(PublicacionesDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!publicacion) {
        console.log('simuladorPublicacionesCC: ingresa a nueva publicacion');
        publicacion = new PublicacionesJssm();
        publicacion.compra = evento.data;
        PublicacionesDB.push(publicacion);
      }

      steper.emit('step',publicacion,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6003, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});

// }
// module.exports = SimuladorPublicaciones;