import React from 'react';
import Poll from 'components/Poll';
import TronWeb from 'tronweb';
import Swal from 'sweetalert2';
import contracts from 'config/contracts';

import './App.scss';

const FOUNDATION_ADDRESS = 'TWiWt5SEDzaEqS6kE5gandWMNfxR2B5xzg';
const contract = contracts['FaceWorthPollFactory'];

class App extends React.Component {
  state = {
    tronWeb: {
      installed: false,
      loggedIn: false
    },
    myPoll: {
      facePhoto: '',
      faceHash: '',
      blocksBeforeReveal: 10, // 30 seconds
      blocksBeforeEnd: 10, // 30 seconds
      loading: false
    },
    recentPolls: [],
    balance: '',
  }

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
      // Set default address (foundation address) used for contract calls
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

    this.contract = window.tronWeb.contract(contract.abi, contract.address);

    this.startEventListener();

    // check block number every 3 seconds. This should be done on server in prod.
    setInterval(() => {
      console.log("Checking Block Number...");
      this.state.recentPolls.map(async (poll) => {
        await this.contract.checkBlockNumber('0x' + poll.hash).send({
          shouldPollResponse: false,
          callValue: 0,
          feeLimit: 1000000000
        });
      });
    }, 3000);

    // refresh account balance
    setInterval(async () => {
      console.log("Checking Account Balance...");
      this.setState({
        balance: await window.tronWeb.trx.getBalance() / 1000000
      })
    }, 1000);
  }

  // Polls blockchain for smart contract events
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
          text: 'txid ' + res,
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
    const stake = await this.contract.stake().call();
    await this.contract.commit(hash, TronWeb.sha3('random'+ score, true)).send({
      shouldPollResponse: false,
      callValue: stake,
      feeLimit: 1000000000
    });
  }

  async onReveal(hash, score) {
    await this.contract.reveal(hash, 'random', score).send({
      shouldPollResponse: false,
      callValue: 0,
      feeLimit: 1000000000
    });
  }

  renderMyPoll() {
    if (!this.state.tronWeb.installed)
      return <div>TronLink is not installed yet.</div>;

    if (!this.state.tronWeb.loggedIn)
      return <div>TronLink is installed but you must first log in. Open TronLink from the browser bar and set up your
        first wallet or decrypt a previously-created wallet.</div>;

    return (
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
        onScore={this.onCommit}
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
            <td>Hash</td>
            <td>Creator</td>
            <td>Face Photo</td>
            <td>Starting Block</td>
            <td>Commit Ending Block</td>
            <td>Reveal Ending Block</td>
            <td>Actions</td>
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
