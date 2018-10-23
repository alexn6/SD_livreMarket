var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;

var _ = require('underscore');
var ComprasJssm = require('../maquinas/compraJssmImpl');
var Steper = require('../Steper');
var steper = new Steper(process.argv[2]);

var comprasDB = new Array();
var compraSec = 0;
var compra;

var MonitorServer = require('../monitorServer');
var monitor = new MonitorServer(steper,comprasDB);

// var SimuladorCompras = function (modo) {

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'compras';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var evento = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',evento);

      compra = _.find(comprasDB,function (compra) {
        return compra.compra.compraId == evento.data.compraId;
      });

      // primero recupera, si existe, la compra. Si no existe crea una nueva
      if (!compra) {
        compra = new ComprasJssm();
        if (typeof(evento.data.compraId) == 'undefined') {
          evento.data.compraId = compraSec++;
          compra.compra.compraId = evento.data.compraId;
        }
        compra.compra = evento.data;
        comprasDB.push(compra);
        //console.log('DB Compras: ',comprasDB);
      }

      steper.emit('step',compra,evento.tarea,evento.data);
      ch.ack(msg);

    }, {noAck: false});
  });
});

monitor.server.listen(6000, function () {
  console.log('Servidor MONITOR escuchando en el puerto %j', monitor.server.address());
});

// }
// module.exports = SimuladorCompras;