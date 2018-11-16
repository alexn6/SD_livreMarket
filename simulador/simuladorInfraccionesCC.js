var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var InfraccionesJssm = require('../maquinas/infraccionJssmImpl');
var Steper = require('../Steper');

var steper = new Steper(process.argv[2]);

var infraccionesDB = new Array();
var infraccion;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,infraccionesDB);
// var MonitorServerWeb = require('../monitorServerWeb');
// var monitor = new MonitorServerWeb(steper,infraccionesDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
var monitor = new MonitorServerSocketJson(steper,infraccionesDB);

// var SimuladorInfracciones = function (modo) {

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'infracciones';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      //console.log('se recibió el mensaje: ',evento);
      console.log('==> [INFRACCIONES]: se recibe la tarea  *** ',evento.tarea,' ***');

      infraccion = _.find(infraccionesDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!infraccion) {
        //console.log('simuladorInfraccionesCC: ingresa a nueva infraccion');
        console.log('[o] [INFRACCIONES]: se crea una nueva infraccion con data: ',evento.data);
        infraccion = new InfraccionesJssm();
        infraccion.compra = evento.data;
        infraccionesDB.push(infraccion);
      }

      steper.emit('step',infraccion,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

// monitor.server.listen(6001, function () {
//   console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
// });

monitor.serverIO.listen(6001, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6001..')
})

// }
// module.exports = SimuladorInfracciones;