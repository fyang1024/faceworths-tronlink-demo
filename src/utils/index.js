import contracts from 'config/contracts';

const contract = contracts['FaceWorthPollFactory'];

const utils = {
    tronWeb: false,
    contract: false,

    setTronWeb(tronWeb) {
        this.tronWeb = tronWeb;
        this.contract = tronWeb.contract(contract.abi, contract.address)
    },

  async getNumberOfParticipants(hash) {
    return await this.contract.getNumberOfParticipants(hash).call();
  },

  async getCommitTimeElapsed(hash) {
      return await this.contract.getCommitTimeElapsed(hash).call();
  },

  async getRevealTimeElapsed(hash) {
      return await this.contract.getRevealTimeElapsed(hash).call();
  },

  async getCurrentStage(hash) {
      return await this.contract.getCurrentStage(hash).call();
  },

  async getParticipants(hash) {
      return await this.contract.getParticipants(hash).call();
  },

  async getWorthBy(hash, participant) {
      return await this.contract.getWorthBy(hash, participant);
  },

  async getWinners(hash) {
    return await this.contract.getWinners(hash);
  },

};

export default utils;