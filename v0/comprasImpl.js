#!/usr/bin/env node

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;

module.exports= Compra;

function Compra(id,rabbit_conn) {
  this.compra = new Object();
  this.compra.compraId = id;

  this.on('productoSeleccionado',function (producto) {
    this.compra.producto = producto;
    this.compra.estado = 'generada';
    // encolar mensaje de productoSeleccionado para Publicaciones, publicaciones 
    var msg = {};
    msg.tarea = 'productoSeleccionado'
    msg.compraId = this.compra.compraId;
    msg.data = this.compra.producto
    publicar('Publicaciones.publicaciones',JSON.stringify(msg));
  });

  this.on('entregaSeleccionada',function (formaEntrega) {
    this.compra.formaEntrega = formaEntrega;
    this.compra.estado = 'con forma de entrega';
    if (formaEntrega == 'correo'){
      this.emit('calcularCosto');
    } else {
      this.emit('costoCalculado',0);
    }
  })

  this.on('calcularCosto',function () {
    // TODO: encolar mensaje para calcula el costo
  })

  this.on('costoCalculado', function (costo) {
    this.compra.costo = costo;
    this.compra.estado = 'con costo de envío calculado';
    this.emit('seleccionarPago');
  });

  this.on('seleccionarPago', function () {
    // TODO: encolar mensaje an servidor web preguntando medio de pago.
  });

  this.on('pagoSeleccionado', function (medioDePago) {
    this.compra.medioDePago = medioDePago;
    this.compra.compraConfirmada = true; // confirma la compra
    this.compra.estado = 'confirmada'
    //console.log('VA A EMITIR compraConfirmada DESDE pagoSeleccionado');
    this.emit('compraConfirmada');
  });

  this.on('publicacionResuelta', function (haspublicacion) {
    this.compra.haspublicacion = haspublicacion;
    this.compra.estado = 'infracción evaluada';
    //console.log('VA A EMITIR compraConfirmada DESDE publicacionResuelta');
    this.emit('compraConfirmada');
  })

  this.on('compraConfirmada',function () {
    if(typeof(this.compra.compraConfirmada) != 'undefined' && typeof(this.compra.haspublicacion) != 'undefined') {
      //existen ambos valores y se presume sincronizada la data. Se continúa con el proceso
      if (this.compra.haspublicacion) {
        // hubo infracción cancela compra e informa
        this.compra.Cancelada = true; // compra Cancelada
        this.compra.motivo = 'tuvo Publicaciones';
        this.compra.estado = 'cancelada';
        this.emit('cancelarCompra');
      } else {
        // todo ok manda a autorizar pago
        this.emit('autorizarPago');
      }
    }
  });

  this.on('cancelarCompra',function () {
    // TODO: encola mensaje cancelando compra e informando el motivo
  })

  this.on('autorizarPago', function () {
    // TODO: encola mensaje de solicitud de autorización de pago
  });

  this.on('pagoAutorizado', function (resultadoPago) {
    this.compra.resultadoPago = resultadoPago;
    this.compra.estado = 'con pago autorizado?';
    if (resultadoPago == 'rechazado') {
      //se cancela la compra por rechazo del pago
      this.compra.Cancelada = true; // compra Cancelada
      this.compra.motivo = 'pago rechazado';
      this.emit('cancelarCompra');
    } else {
      // todo ok manda a autorizar pago
      this.emit('enviarProducto');
    }
  });

  this.on('enviarProducto',function () {
    this.compra.estado = 'pagado';
    if (this.compra.formaEntrega == 'correo') {
      this.emit('agendarEnvio');
    } else {
      this.emit('finalizarCompra');
    }
  });

  this.on('agendarEnvio',function () {
    // encola mensaje para agendar el envio x correo
    this.emit('finalizarCompra');
  });

  this.on('finalizarCompra',function () {
    this.compra.estado = 'finalizada';
  });

};

util.inherits(Compra,EventEmitter);

Compra.prototype.imprimirCompra = function imprimirCompra() {
  console.log(this.compra);
};

function publicar(topico,mensaje) {
  amqp.connect(amqp_url, function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'livre_market';
      ch.assertExchange(ex, 'topic', {durable: true});
      ch.publish(ex,topico, new Buffer(mensaje));
      console.log(" [x] Sent %s: '%s'", topico, mensaje);
    });
  });
};
