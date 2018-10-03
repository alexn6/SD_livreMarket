#!/usr/bin/env node

var Compra = require('./comprasImpl');
var sleep = require('sleep');
// simula la llegada de un nuevo mensaje encolado de compra

comprar('producto1');
comprar('producto2');
comprar('producto3');
comprar('producto4');
comprar('producto5');

function comprar(producto) {
  var compra = new Compra();
  compra.emit('productoSeleccionado',producto);
  sleep.msleep(Math.floor(Math.random() * 1e3));
  compra.imprimirCompra();

  // simula entrega
  var entrega = Math.random() > 0.5 ? 'retira' : 'correo';
  compra.emit('entregaSeleccionada',entrega);
  if (entrega == 'correo') {
    sleep.msleep(Math.floor(Math.random() * 1e3));
    compra.emit('costoCalculado',Math.random() * 1e3)
  }
  sleep.msleep(Math.floor(Math.random() * 1e3));
  compra.imprimirCompra();

  // simula medio de pago
  var pago = Math.random() > 0.5 ? 'efectivo' : 'tarjeta';
  compra.emit('pagoSeleccionado',pago);
  sleep.msleep(Math.floor(Math.random() * 1e3));
  compra.imprimirCompra();

  //simula solicitud de infracción
  var haspublicacion = Math.random() > 0.5 ? true : false;
  compra.emit('publicacionResuelta',haspublicacion);
  sleep.msleep(Math.floor(Math.random() * 1e3));
  compra.imprimirCompra();

  // simula pago autorizado sólo si no tiene infracción
  if (!haspublicacion) {
    var autorizado = Math.random() > 0.5 ? 'autorizado' : 'rechazado';
    compra.emit('pagoAutorizado',autorizado);
    sleep.msleep(Math.floor(Math.random() * 1e3));
    compra.imprimirCompra();
    if (autorizado == 'autorizado') {
      // simula enviar producto
      compra.emit('enviarProducto');
      sleep.msleep(Math.floor(Math.random() * 1e3));
      compra.imprimirCompra();
    }
  }

  // finaliza simulación
  console.log('**********************************************************************');
  console.log('*** SIMULACION FINALIZADA ' + compra.compra.producto + ' ***');
  console.log('**********************************************************************');
  compra.imprimirCompra();
  console.log('\n\n');
  //console.log(compra);
}
