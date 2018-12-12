import React from 'react';
import Poll from 'components/Poll';
import TronWeb from 'tronweb';
import Swal from 'sweetalert2';
import contracts from 'config/contracts';

import './App.scss';

const FOUNDATION_ADDRESS = 'TWiWt5SEDzaEqS6kE5gandWMNfxR2B5xzg';
const factory = contracts['FaceWorthPollFactory'];
const token = contracts['FaceToken'];

class App extends React.Component {
  state = {
    tronWeb: {
      installed: false,
      loggedIn: false
    },
    myPoll: {
      facePhoto: '',
      faceHash: '',
      blocksBeforeReveal: 20, // 30 seconds
      blocksBeforeEnd: 20, // 30 seconds
      loading: false
    },
    recentPolls: [],
    balance: '',
    currentBlock: ''
  };

  constructor(props) {
    super(props);

    this.changeFacePhoto = this.changeFacePhoto.bind(this);
    this.startFacePoll = this.startFacePoll.bind(this);
    this.onCommit = this.onCommit.bind(this);
    this.onReveal = this.onReveal.bind(this);
    this.shorten = this.shorten.bind(this);
  }

  async componentDidMount() {
    await new Promise(resolve => {
      const tronWebState = {
        installed: !!window.tronWeb,
        loggedIn: window.tronWeb && window.tronWeb.ready
      };

      if (tronWebState.installed) {
        this.setState({
          tronWeb:
          tronWebState
        });

        return resolve();
      }

      let tries = 0;

      const timer = setInterval(() => {
        if (tries >= 10) {
          const TRONGRID_API = 'https://api.shasta.trongrid.io';

          window.tronWeb = new TronWeb(
            TRONGRID_API,
            TRONGRID_API,
            TRONGRID_API
          );

          this.setState({
            tronWeb: {
              installed: false,
              loggedIn: false
            }
          });

          clearInterval(timer);
          return resolve();
        }

        tronWebState.installed = !!window.tronWeb;
        tronWebState.loggedIn = window.tronWeb && window.tronWeb.ready;

        if (!tronWebState.installed)
          return tries++;

        this.setState({
          tronWeb: tronWebState
        });

        resolve();
      }, 100);
    });

    if (!this.state.tronWeb.loggedIn) {
      // Set default address (foundation address) used for factory calls
      // Directly overwrites the address object as TronLink disabled the
      // function call
      window.tronWeb.defaultAddress = {
        hex: window.tronWeb.address.toHex(FOUNDATION_ADDRESS),
        base58: FOUNDATION_ADDRESS
      };

      window.tronWeb.on('addressChanged', () => {
        if (this.state.tronWeb.loggedIn)
          return;

        this.setState({
          tronWeb: {
            installed: true,
            loggedIn: true
          }
        });
      });
    }

    this.contract = window.tronWeb.contract(factory.abi, factory.address);

    this.startEventListener();

    // check block number every 3 seconds. This should be done on server in prod.
    setInterval(async () => {
      console.log("Checking Block Number...");
      this.state.recentPolls.map(async (poll) => {
        await this.contract.checkBlockNumber('0x' + poll.hash).send({
          shouldPollResponse: false,
          callValue: 0,
          feeLimit: 1000000000
        });
      });
      let currentBlock = await window.tronWeb.trx.getCurrentBlock();
      this.setState({
        currentBlock: currentBlock.block_header.raw_data.number
      });
    }, 3000);

    // refresh account balance
    setInterval(async () => {
      console.log("Checking Account Balance...");
      this.setState({
        balance: await window.tronWeb.trx.getBalance() / 1000000
      })
    }, 3000);

  }

  // Polls blockchain for smart factory events
  startEventListener() {
    this.contract.FaceWorthPollCreated().watch((err, {result}) => {
      if (err) return console.error('Failed to bind event listener:', err);
      console.log('Detected new poll:', result);
      const {recentPolls} = this.state;
      result.score = Math.floor(Math.random() * 6);
      recentPolls.push(result);
      this.setState({
        recentPolls: recentPolls
      });
    });
    this.contract.StageChange().watch(async (err, {result}) => {
      if (err) return console.error('Failed to bind event listener:', err);
      console.log('Detected stage change:', result);
      // if (result.newStage === 4) {
      //   let winners = await this.contract.getWinners('0x' + result.hash).call();
      //   for(let i=0; i<winners.length; i++) {
      //     if (winners[i] === window.tronWeb.defaultAddress.hex) {
      //       Swal({
      //         title: 'Lucky you win!',
      //         type: 'success'
      //       })
      //     }
      //   }
      // }
    });
  }

  // Stores value of textarea to state
  changeFacePhoto({target: {value}}) {
    this.setState({
      myPoll: {
        facePhoto: value,
        faceHash: value ? TronWeb.sha3(value, true) : '',
        blocksBeforeReveal: this.state.myPoll.blocksBeforeReveal,
        blocksBeforeEnd: this.state.myPoll.blocksBeforeEnd,
        loading: this.state.myPoll.loading
      }
    });
  }

  async startFacePoll() {

    this.setState({
      myPoll: {
        facePhoto: this.state.myPoll.facePhoto,
        faceHash: this.state.myPoll.faceHash,
        blocksBeforeReveal: this.state.myPoll.blocksBeforeReveal,
        blocksBeforeEnd: this.state.myPoll.blocksBeforeEnd,
        loading: true
      }
    });

    const {
      faceHash,
      blocksBeforeReveal,
      blocksBeforeEnd
    } = this.state.myPoll;


    this.contract.createFaceWorthPoll(faceHash, blocksBeforeReveal, blocksBeforeEnd).send({
      shouldPollResponse: true,
      callValue: 0,
      feeLimit: 1000000000
    }).then(res => {
        Swal({
          title: 'FacePoll created',
          type: 'success'
        })
      }
    ).catch(err => Swal({
      title: 'FacePoll creation failed',
      type: 'error'
    })).then(() => {
      this.setState({
        myPoll: {
          facePhoto: this.state.myPoll.facePhoto,
          faceHash: this.state.myPoll.faceHash,
          blocksBeforeReveal: this.state.myPoll.blocksBeforeReveal,
          blocksBeforeEnd: this.state.myPoll.blocksBeforeEnd,
          loading: false
        }
      });
    });

  }


  shorten(s) {
    return s.substr(0, 5) + '...' + s.substring(s.length - 5);
  }

  async onCommit(hash, score) {
    let currentStage = await this.contract.getCurrentStage('0x' + hash).call();
    switch (currentStage) {
      case 1:
        const stake = await this.contract.stake().call();
        await this.contract.commit('0x' + hash, TronWeb.sha3('random'+ score, true)).send({
          shouldPollResponse: false,
          callValue: stake,
          feeLimit: 1000000000
        });
        break;
      case 2:
        alert("Commit stage passed");
        break;
      case 3:
        alert("It's cancelled");
        break;
      case 4:
        alert("It's ended");
        break;
      default:
        break;
    }
  }

  async onReveal(hash, score) {
    let currentStage = await this.contract.getCurrentStage('0x' + hash).call();
    switch (currentStage) {
      case 1:
        alert("Not revealing yet");
        break;
      case 2:
        await this.contract.reveal('0x' + hash, 'random', score).send({
          shouldPollResponse: false,
          callValue: 0,
          feeLimit: 1000000000
        });
        break;
      case 3:
        alert("It's cancelled");
        break;
      case 4:
        alert("It's ended");
        break;
      default:
        break;
    }
  }

  renderMyPoll() {
    if (!this.state.tronWeb.installed)
      return <div>TronLink is not installed yet.</div>;

    if (!this.state.tronWeb.loggedIn)
      return <div>TronLink is installed but you must first log in. Open TronLink from the browser bar and set up your
        first wallet or decrypt a previously-created wallet.</div>;

    return (
      <div className="kontainer">
        <div>
          <div>My TRON account: {this.shorten(window.tronWeb.defaultAddress.base58)}</div>
          <div>Account Balance: <h3>{this.state.balance}</h3></div>
          <textarea
            placeholder='Enter some random stuff and it will be hashed just like a photo'
            value={this.state.myPoll.facePhoto} cols={80} onChange={this.changeFacePhoto}>
                  </textarea>
          <div><label>Face hash: </label>{this.state.myPoll.faceHash}</div>
          <div><label>Commit blocks</label><input type="number" value={this.state.myPoll.blocksBeforeReveal}
                                                  readOnly={true}/></div>
          <div><label>Reveal blocks</label><input type="number" value={this.state.myPoll.blocksBeforeEnd}
                                                  readOnly={true}/></div>
          <button disabled={!this.state.myPoll.facePhoto || this.state.myPoll.loading} onClick={this.startFacePoll}>
            Start FacePoll
          </button>
        </div>
        <div>
          <div>FaceToken address: {window.tronWeb.address.fromHex(token.address)}</div>
          <div>Current Block: <h3>{this.state.currentBlock}</h3></div>
        </div>
      </div>
    );
  }

  render() {

    const polls = this.state.recentPolls.map(recentPoll => (
      <Poll
        key={recentPoll.hash}
        hash={recentPoll.hash}
        creator={window.tronWeb.address.fromHex(recentPoll.creator)}
        faceHash={recentPoll.faceHash}
        startingBlock={recentPoll.startingBlock}
        commitEndingBlock={recentPoll.commitEndingBlock}
        revealEndingBlock={recentPoll.revealEndingBlock}
        score={recentPoll.score}
        onCommit={this.onCommit}
        onReveal={this.onReveal}
        shorten={this.shorten}
      />
    ));

    return (
      <div>
        {this.renderMyPoll()}
        <h2>Face Worth Polls</h2>
        <table>
          <thead>
          <tr>
            <th>Hash</th>
            <th>Creator</th>
            <th>Face Photo</th>
            <th>Starting Block</th>
            <th>Commit Ending Block</th>
            <th>Reveal Ending Block</th>
            <th>Score</th>
            <th>Actions</th>
          </tr>
          </thead>
          <tbody>
            {polls}
          </tbody>
        </table>
      </div>
    );
  }
}

export default App;
