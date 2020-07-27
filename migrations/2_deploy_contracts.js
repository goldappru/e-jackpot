const Ownable = artifacts.require("Ownable");
const DateTime = artifacts.require("DateTime");
const EJackpot = artifacts.require("EJackpot");

module.exports = (deployer) => {
    deployer.deploy(Ownable)
        .then(() => deployer.deploy(DateTime))
        .then(() => deployer.deploy(EJackpot, DateTime.address))
};
