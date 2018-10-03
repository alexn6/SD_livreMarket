var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;
var _ = require('underscore');
var ComprasJssm = require('./compraJssmImpl');

var comprasDB = new Array();
var compraSec = 0;
var compra;
var pila_eventos =[];

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

      console.log('SimuladorComprasCC: Se dispara la transición ',evento.tarea,' con data: ',evento.data);
      pila_eventos = compra[evento.tarea](evento.data);
      if (pila_eventos) {
        for (var evento of pila_eventos) {
          compra[evento]();
        }
      }
      ch.ack(msg);

    }, {noAck: false});
  });
});
