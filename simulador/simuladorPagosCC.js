var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;
var _ = require("underscore");
var PagosJssm = require('../maquinas/pagoJssmImpl');
var Steper = require('../Steper');

var steper = new Steper(process.argv[2]);

var PagosDB = new Array();
var pago;

var MonitorServer = require('../monitorServer');
var monitor = new MonitorServer(steper,PagosDB);

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    // la cola a la que se suscribe el simulador
    var q = 'pagos';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      pago = _.find(PagosDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      if (!pago) {
        console.log('simuladorPagosCC: ingresa a nueva infraccion');
        pago = new PagosJssm();
        pago.compra = evento.data;
        PagosDB.push(pago);
      }

      steper.emit('step',pago,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6004, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});
