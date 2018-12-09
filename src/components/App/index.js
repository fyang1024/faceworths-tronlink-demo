import React from 'react';
import Poll from 'components/Poll';
import TronWeb from 'tronweb';
import Utils from 'utils';
import Swal from 'sweetalert2';

import './App.scss';

const FOUNDATION_ADDRESS = 'TWiWt5SEDzaEqS6kE5gandWMNfxR2B5xzg';

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
          loading : false
        },
        recentPolls: []
    }

    constructor(props) {
        super(props);

        this.changeFacePhoto = this.changeFacePhoto.bind(this);
        this.startFacePoll = this.startFacePoll.bind(this);
        this.onScore = this.onScore.bind(this);
    }

    async componentDidMount() {
        await new Promise(resolve => {
            const tronWebState = {
                installed: !!window.tronWeb,
                loggedIn: window.tronWeb && window.tronWeb.ready
            };

            if(tronWebState.installed) {
                this.setState({
                    tronWeb:
                    tronWebState
                });

                return resolve();
            }

            let tries = 0;

            const timer = setInterval(() => {
                if(tries >= 10) {
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

                if(!tronWebState.installed)
                    return tries++;

                this.setState({
                    tronWeb: tronWebState
                });

                resolve();
            }, 100);
        });

        if(!this.state.tronWeb.loggedIn) {
            // Set default address (foundation address) used for contract calls
            // Directly overwrites the address object as TronLink disabled the
            // function call
            window.tronWeb.defaultAddress = {
                hex: window.tronWeb.address.toHex(FOUNDATION_ADDRESS),
                base58: FOUNDATION_ADDRESS
            };

            window.tronWeb.on('addressChanged', () => {
                if(this.state.tronWeb.loggedIn)
                    return;

                this.setState({
                    tronWeb: {
                        installed: true,
                        loggedIn: true
                    }
                });
            });
        }

        Utils.setTronWeb(window.tronWeb);

        this.startEventListener();
    }

    // Polls blockchain for smart contract events
    startEventListener() {
        Utils.contract.FaceWorthPollCreated().watch((err, { result }) => {
            if(err)
                return console.error('Failed to bind event listener:', err);

            console.log('Detected new poll:', result);
            // this.fetchMessage(+result.id);
        });
    }

    // Stores value of textarea to state
    changeFacePhoto({ target: { value } }) {
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

        const stake = await Utils.contract.stake().call();

        Utils.contract.createFaceWorthPoll(faceHash, blocksBeforeReveal, blocksBeforeEnd).send({
          shouldPollResponse: true,
          callValue: 0,
          feeLimit: 10000000
        }).then(res=> Swal({
          title: 'FacePoll created',
          text: 'txid ' + res,
          type: 'success'
        })).catch(err => Swal({
          title: 'FacePoll creation failed',
          type: 'error'
        })).then(()=> {
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

  async onScore(hash, score) {

  }


  renderMyPoll() {
        if(!this.state.tronWeb.installed)
            return <div>TronLink is not installed yet.</div>;

        if(!this.state.tronWeb.loggedIn)
            return <div>TronLink is installed but you must first log in. Open TronLink from the browser bar and set up your
              first wallet or decrypt a previously-created wallet.</div>;

        return (
            <div>
                <textarea
                    placeholder='Enter some random stuff and it will be hashed just like a photo'
                    value={ this.state.myPoll.facePhoto } cols={80} onChange = { this.changeFacePhoto }>
                </textarea>
              <div><label>Face hash: </label>{ this.state.myPoll.faceHash }</div>
                <div><label>Commit blocks</label><input type="number" value={ this.state.myPoll.blocksBeforeReveal } readOnly={true}/></div>
              <div><label>Reveal blocks</label><input type="number" value={ this.state.myPoll.blocksBeforeEnd } readOnly={true}/></div>
                  <button disabled={ !this.state.myPoll.facePhoto || this.state.myPoll.loading } onClick={ this.startFacePoll }>Start FacePoll</button>
            </div>
        );
    }

    render() {

        const polls = this.state.recentPolls.map(recentPoll => (
            <Poll
                key={ recentPoll.hash }
                hash = { recentPoll.hash }
                creator={ recentPoll.creator }
                startingBlock = {recentPoll.startingBlock}
                commitEndingBlock = {recentPoll.commitEndingBlock}
                revealEndingBlock = {recentPoll.revealEndingBlock}
                score = {Math.floor(Math.random() * 6)}
                onScore={ this.onScore } />
        ));

        return (
            <div className='kontainer'>

                { this.renderMyPoll() }

                <div>
                    { polls }
                </div>
            </div>
        );
    }
}

export default App;
