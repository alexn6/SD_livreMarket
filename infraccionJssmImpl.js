var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;
var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var InfraccionesJssm = require('javascript-state-machine').factory({
  init: 'compraGenerada',
  transitions: [
    {name:'detectarInfracciones',     from:'compraGenerada',                                  to:'resolviendoInfraccion'},
    {name:'resolverInfraccion',       from:'resolviendoInfraccion',                           to:'informandoInfraccion'},
    {name:'informarInfraccion',       from:'informandoInfraccion',                            to:function (data) {return toInfraccionResuelta(data)}},
    {name:'reintentarInfraccion',     from:['compraSinInfraccion','compraConInfraccion'],     to:function (data) {return toInfraccionResuelta(data)}}
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

    onDetectarInfracciones: function (lifeCycle,data) {
      //console.log('onDetectarInfracciones: data --> ',data);
      this.compra = data;
      return ['resolverInfraccion'];
    },

    onResolverInfraccion: function (lifeCycle,data) {
      //console.log('onResolverInfraccion: data --> ',data);
      this.compra.hasInfraccion = Math.random() > 0.7 ? true : false;
      return ['informarInfraccion'];
    },

    onInformarInfraccion: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('compras',JSON.stringify(msg));
      return false;
    },

    onReintentarInfraccion: function (lifeCycle,data) {
      // Se solicitó re-informar la infracción con lo cual se re-emite el estado
      return ['informarInfraccion'];
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
function toInfraccionResuelta(data) {
  if (_.pick(data,'hasInfraccion').hasInfraccion) {
    return 'compraConInfraccion';
  } else {
    return 'compraSinInfraccion';
  }
};

module.exports= InfraccionesJssm;
