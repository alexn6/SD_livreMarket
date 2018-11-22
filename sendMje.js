#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

// usando propiedades almacenadas en un archivo
var amqp_url = require('./properties.json').amqp.url;

var SenderMjes = function () {

  this.create = function(){
    amqp.connect(amqp_url, function(err, conn) {
      conn.createChannel(function(err, ch) {
        var q = 'compras';
        var msg = '{"tarea":"generarNuevaCompra","data":{"producto":"producto1","cliente":"cliente1"}}';
    
        ch.assertQueue(q, {durable: true});
        ch.sendToQueue(q, Buffer.from(msg));
        console.log(" [x] Envió el mensaje %s", msg);
      });
      // setTimeout(function() { conn.close(); process.exit(0) }, 500);
      setTimeout(function() { conn.close() }, 500);
    });
  }

}

module.exports = SenderMjes;