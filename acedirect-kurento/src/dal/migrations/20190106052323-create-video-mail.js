'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('ace_direct_video_mail', {
    id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    peer: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false
    },
    filename: {
      type: Sequelize.STRING(200),
      allowNull: false
    }
  }),
  down: (queryInterface, _Sequelize) => queryInterface.dropTable('ace_direct_video_mail')
};
