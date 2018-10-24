var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;

// recuperamoslos datos corrspondiente a cada escenario
//var datosSimulacion = require('../datosSimulacion.json').compraConInfraccion;
//var datosSimulacion = require('../datosSimulacion.json').compraPagoRechazado;
var datosSimulacion = require('../datosSimulacion.json').compraExitosaPorCorreo;

var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var PagosJssm = require('javascript-state-machine').factory({
  init: 'compraConfirmada',
  transitions: [
    {name:'autorizarPago',                  from:['compraConfirmada', 'autorizandoPago'],                                to:'resolviendoAutorizacionPago'},
    {name:'resolverAutorizacionPago',       from:'resolviendoAutorizacionPago',                     to:'informandoAutorizacionPago'},
    // deberia devolver(to) "pagorechazado" o "pagoAutorizado"
    // para que tome el estado inicial(from) el SRV_CMPRAS 
    {name:'informarAutorizacionPago',       from:'informandoAutorizacionPago',                      to:'autorizacionPagoInformado'}
    // {name:'informarAutorizacionPago',       from:'informandoAutorizacionPago',                      to:function (data) {return toAutorizacionResuelta(data)}}
  ],

  data: {
    compra: new Object(),
    stepsQ: new Array()
  },

  plugins: [
      new StateMachineHistory()     //  <-- plugin enabled here
  ],

  methods: {

    onTransition: function (lifeCycle,data) {
      // console.log('onTransition transition: ',lifeCycle.transition);
      // console.log('onTransition from: ',lifeCycle.from);
      // console.log('onTransition to: ',lifeCycle.to);
      // console.log('onTransition data: ',data);
      console.log('onTransition history: ',this.history);
    },

    onAutorizarPago: function (lifeCycle,data) {
      console.log(' ************** onAutorizarPago: data --> ');
      console.log(data);
      this.compra = data;
      return ['resolverAutorizacionPago'];
    },

    onResolverAutorizacionPago: function (lifeCycle,data) {
      //console.log('onResolverInfraccion: data --> ',data);
      // this.compra.pagoAutorizado = Math.random() > 0.7 ? true : false;
      //this.compra.pagoAutorizado = true;
      this.compra.pagoAutorizado = datosSimulacion.pagoAutorizado;
      return ['informarAutorizacionPago'];
    },

    onInformarAutorizacionPago: function (lifeCycle,data) {
      // console.log("=== onInformarAutorizacionpago => Data recibida: ");
      // console.log(data);
      var msg =  {};
      msg.data = this.compra;
      // console.log("=== onInformarAutorizacionpago => Data enviada: ");
      // console.log(msg.data);
      msg.tarea = lifeCycle.transition;
      // tmb se deberia publicar el mensaje en el de publicaciones
      publicar('compras',JSON.stringify(msg));
      publicar('publicaciones',JSON.stringify(msg));
      return false;
    }

  }

});

// helper para publicar un mensaje en el exchange de rabbitmq
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

// helper para determinar transición condicional de infracción
function toAutorizacionResuelta(data) {
  if (_.pick(data,'pagoAutorizado').pagoAutorizado) {
    return 'pagoAutorizado';
  } else {
    return 'pagoRechazado';
  }
};

module.exports= PagosJssm;
