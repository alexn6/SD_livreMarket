var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;

var _ = require("underscore");
var WebJssm = require('./webJssmImpl');
var Steper = require('./Steper');

var steper = new Steper(process.argv[2]);

//./csimul la Implllegada de un nuevo mensaje encolado de compra

var webDB = new Array();
var web;

var MonitorServer = require('./monitorServer');
var monitor = new MonitorServer(steper,webDB);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'web';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      web = _.find(webDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      //console.log('simuladorPublicacionesCC 1: publicacion recuperada --> ',publicacion);

      if (!web) {
        //console.log('simuladorPublicacionesCC: ingresa a nueva publicacion');
        web = new WebJssm();
        web.compra = evento.data
        webDB.push(web);
      }

      // console.log('simuladorPublicacionesCC 2 --> ',evento.tarea);
      // console.log('simuladorPublicacionesCC 3 --> ',evento.data);
      // console.log('simuladorPublicacionesCC 4 --> ',publicacion);

      steper.emit('step',web,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6002, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});
