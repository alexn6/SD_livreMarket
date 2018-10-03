#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var Compra = require('./comprasImpl');
var _ = require("underscore");
var amqp_url = require('./properties.json').amqp.url;
// simula la llegada de un nuevo mensaje encolado de compra

var comprasDB = [];
var compraSec = 0;

amqp.connect(amqp_url, function(err, conn) {
  conn.createChannel(function(err, ch) {
    var q = 'compras';

    ch.assertQueue(q, {durable: true});
    console.log(" [*] Esperando mensajes en %s. Para salir presione CTRL+C", q);
    ch.consume(q, function(msg) {
      var tarea = JSON.parse(msg.content.toString());
      console.log('se recibió el mensaje: ',tarea);

      var compra;
      // primero recupera, si existe, la compra. Si no existe crea una nueva
      if (typeof(tarea.compraId) == 'undefined') {
        //console.log('no existe compra, la crea...');
        //no existe creo y empujo en la DB
        compraSec++;
        compra= new Compra(compraSec);
        comprasDB.push(compra);
        //console.log('DB Compras: ',comprasDB);
      } else {
        // ya existe la compra se busca
        compra = _.find(comprasDB,function (compra) {
          return compra.compra.compraId == tarea.compraId;
        });
      }
      // en función de el nombre del evento procesa el mensaje de forma automática
      compra.emit(tarea.tarea,tarea.data);
      console.log(compra.compra);
    }, {noAck: false});
  });
});
