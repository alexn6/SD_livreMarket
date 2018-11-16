var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;

var _ = require("underscore");
var WebJssm = require('../maquinas/webJssmImpl');
// var Steper = require('../Steper');
// var steper = new Steper(process.argv[2]);
var SteperSocketJson = require('../SteperSocketJson');
var steperSocketJson = new SteperSocketJson(process.argv[2]);

var webDB = new Array();
var web;

// var MonitorServer = require('../monitorServer');
// var monitor = new MonitorServer(steper,webDB);
var MonitorServerSocketJson = require('../monitorServerSocketJson');
// var monitor = new MonitorServerSocketJson(steper,webDB);
var monitor = new MonitorServerSocketJson(steperSocketJson,webDB);

// var SimuladorWeb = function (modo) {

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'web';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      //console.log('se recibió el mensaje: ',evento);
      console.log('==> [WEB]: se recibe la tarea  *** ',evento.tarea,' ***');

      web = _.find(webDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      //console.log('simuladorPublicacionesCC 1: publicacion recuperada --> ',publicacion);

      if (!web) {
        //console.log('simuladorPublicacionesCC: ingresa a nueva publicacion');
        console.log('[o] [WEB]: se crea un nuevo web con data: ',evento.data);
        web = new WebJssm();
        web.compra = evento.data;
        webDB.push(web);
      }

      // console.log('simuladorPublicacionesCC 2 --> ',evento.tarea);
      // console.log('simuladorPublicacionesCC 3 --> ',evento.data);
      // console.log('simuladorPublicacionesCC 4 --> ',publicacion);

      // steper.emit('step',web,evento.tarea,evento.data);
      steperSocketJson.emit('step',web,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

// monitor.server.listen(6002, function () {
//   console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
// });

monitor.serverIO.listen(6002, function () {
  console.log('Servidor MONITOR-IO de compras escuchando en localhost:6002..')
})

// }
// module.exports = SimuladorWeb;