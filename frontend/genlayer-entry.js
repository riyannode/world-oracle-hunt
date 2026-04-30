// Browser bundle entry point — re-export genlayer-js + helpers
import * as gl from "genlayer-js";
import * as glChains from "genlayer-js/chains";
import * as glTypes from "genlayer-js/types";
window.genlayer = { ...gl, chains: glChains, types: glTypes };
