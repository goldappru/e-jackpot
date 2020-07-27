const EJackpot = artifacts.require("EJackpot");
const DummyContract = artifacts.require("DummyContract");

async function handleErrorTransaction(transaction) {
    let error;

    try {
        await transaction();
    } catch (e) {
        error = e;
    } finally {
        assert.isDefined(error, "Revert was not thrown out");
    }
}

contract("EJackpot", accounts => {
    let contract;
    const value = 15 * 10 ** 18; // 15 ether
    const emptyAddress = "0x0000000000000000000000000000000000000000";
    const [unknownAccount, referrer] = [accounts[1], accounts[2]];
    const cases = [5 * 10 ** 16, 10 ** 17, 2 * 10 ** 17, 3 * 10 ** 17, 5 * 10 ** 17, 7 * 10 ** 17, 10 ** 18, 15 * 10 ** 17, 2 * 10 ** 18];
    before(async () => contract = await EJackpot.deployed());

    async function makeBet(bet) {
        const getInfo = () => Promise.all([
            web3.eth.getBalance(unknownAccount),
            contract.openedCases(),
            contract.usersCount(),
            contract.caseWins(bet.toString()),
            contract.caseOpenings(bet.toString()),
            contract.totalWins(),

        ]);
        const [balanceBefore, openedCasesBefore, usersCountBefore, caseWinsBefore, caseOpeningsBefore, totalWinsBefore] = await getInfo();
        await contract.play.sendTransaction(emptyAddress, {from: unknownAccount, value: bet.toString()});
        const [balanceAfter, openedCasesAfter, usersCountAfter, caseWinsAfter, caseOpeningsAfter, totalWinsAfter] = await getInfo();
        const prizes = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .map(i => contract.betsPrizes(bet.toString(), i).then(m => m.toNumber() * (10**18/10000))));
        const prize = bet + (balanceAfter - balanceBefore);

        assert.notStrictEqual(prizes.indexOf(prize), -1, "Multiplier not found");
        assert.strictEqual(openedCasesAfter - openedCasesBefore, 1, "Invalid openedCases");
        assert.strictEqual(usersCountAfter - usersCountBefore, cases.indexOf(bet) === 0 ? 1 : 0, "Invalid usersCount");
        assert.strictEqual(caseWinsAfter.sub(caseWinsBefore).toString(), prize.toString(), "Invalid caseWins");
        assert.strictEqual(caseOpeningsAfter - caseOpeningsBefore, 1, "Invalid caseOpenings");
        assert.strictEqual(totalWinsAfter - totalWinsBefore, prize, "Invalid totalWins");

        return true;
    }

    it("Default cases should be set properly", async () => {
        const result = Promise.all(cases.map(c => contract.cases(c.toString())))
            .then(result => result.reduce((pv, cv) => pv && cv, true));

        assert.strictEqual(await result, true);
    });

    it("Should increase contract balance from owner's address", async () => {
        const [contractBalanceBefore, ownerBalanceBefore] = await Promise.all([web3.eth.getBalance(contract.address), web3.eth.getBalance(accounts[0])]);
        await contract.play.sendTransaction(emptyAddress, {value: value.toString()});
        const [contractBalanceAfter, ownerBalanceAfter] = await Promise.all([web3.eth.getBalance(contract.address), web3.eth.getBalance(accounts[0])]);
        assert.strictEqual(ownerBalanceBefore - ownerBalanceAfter, value, "Owner balance mismatch");
        assert.strictEqual(contractBalanceAfter - contractBalanceBefore, value, "Contract balance mismatch");
    });

    it("Should not increase contract balance from unknown account", async () =>
        handleErrorTransaction(() => contract.play.sendTransaction(emptyAddress, {
            value: value.toString(),
            from: unknownAccount
        })));

    it("Should get prize after sending ether to contract", async () => {
        const callMakeBet = i => makeBet(cases[i]).then(() => (i + 1) === cases.length ? null : callMakeBet(i + 1));
        await callMakeBet(0);
    });

    it("Should send 10% of casino profit to referrer with referrer address as parameter", async () => {
        const getInfo = () => Promise.all([
            web3.eth.getBalance(unknownAccount),
            web3.eth.getBalance(referrer),
            contract.referralStats(referrer)
        ]);
        const [balancePlayerBefore, balanceReferrerBefore, referralStatsBefore] = await getInfo();
        await contract.play.sendTransaction(referrer, {from: unknownAccount, value: cases[0].toString()});
        const [balancePlayerAfter, balanceReferrerAfter, referralStatsAfter] = await getInfo();
        const prizes = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            .map(i => contract.betsPrizes(cases[0].toString(), i).then(m => m.toNumber() * (10**18/10000))));
        const prize = cases[0] + (balancePlayerAfter - balancePlayerBefore);
        const casinoProfit = cases[0] - prize;
        const referrerPercent = casinoProfit > 0 ? casinoProfit * 0.1 : 0;

        assert.notStrictEqual(prizes.indexOf(prize), -1, "Multiplier not found");
        assert.strictEqual(balanceReferrerAfter - balanceReferrerBefore, referrerPercent, "Invalid referrer reward");
        assert.strictEqual(referralStatsAfter.profit - referralStatsBefore.profit, referrerPercent, "Invalid profit in stats");
        assert.strictEqual(referralStatsAfter.count - referralStatsBefore.count, 1, "Invalid count in stats");
    });

    it("Should send 10% of casino profit to referrer when referrer was already set", async () => {
        const getInfo = () => Promise.all([
            web3.eth.getBalance(unknownAccount),
            web3.eth.getBalance(referrer),
            contract.referralStats(referrer)
        ]);
        const [balancePlayerBefore, balanceReferrerBefore, referralStatsBefore] = await getInfo();
        await contract.play.sendTransaction(emptyAddress, {from: unknownAccount, value: cases[0].toString()});
        const [balancePlayerAfter, balanceReferrerAfter, referralStatsAfter] = await getInfo();
        const prizes = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            .map(i => contract.betsPrizes(cases[0].toString(), i).then(m => m.toNumber() * (10**18/10000))));
        const prize = cases[0] + (balancePlayerAfter - balancePlayerBefore);
        const casinoProfit = cases[0] - prize;
        const referrerPercent = casinoProfit > 0 ? casinoProfit * 0.1 : 0;

        assert.notStrictEqual(prizes.indexOf(prize), -1, "Multiplier not found");
        assert.strictEqual(balanceReferrerAfter - balanceReferrerBefore, referrerPercent, "Invalid referrer reward");
        assert.strictEqual(referralStatsAfter.profit - referralStatsBefore.profit, referrerPercent, "Invalid profit in stats");
        assert.strictEqual(referralStatsAfter.count.toNumber(), referralStatsBefore.count.toNumber(), "Invalid count in stats");
    });

    it("Should decrease count in stats for referrer who lost referral", async () => {
        const getInfo = () => Promise.all([
            contract.referralStats(referrer),
            contract.referralStats(accounts[3])
        ]);
        const [referralStatsBefore1, referralStatsBefore2] = await getInfo();
        await contract.play.sendTransaction(accounts[3], {from: unknownAccount, value: cases[0].toString()});
        const [referralStatsAfter1, referralStatsAfter2] = await getInfo();

        assert.strictEqual(referralStatsBefore1.count - referralStatsAfter1.count, 1, "Invalid count in stats1");
        assert.strictEqual(referralStatsAfter2.count - referralStatsBefore2.count, 1, "Invalid count in stats2");
    });

    it("Should not be able to use contract address as referrer", () => handleErrorTransaction(() =>
        contract.play.sendTransaction(DummyContract.address, {from: unknownAccount, value: cases[0].toString()})));

    it("Should not be able to withdraw ether from unknown account", () =>
        handleErrorTransaction(async () =>
            contract.withdraw.sendTransaction(await web3.eth.getBalance(contract.address), {from: unknownAccount})));

    it("Should be able to withdraw ether from the owner", async () => {
        const [contractBalanceBefore, ownerBalanceBefore] = await Promise.all([web3.eth.getBalance(contract.address), web3.eth.getBalance(accounts[0])]);
        await contract.withdraw.sendTransaction((await web3.eth.getBalance(contract.address)).toString());
        const [contractBalanceAfter, ownerBalanceAfter] = await Promise.all([web3.eth.getBalance(contract.address), web3.eth.getBalance(accounts[0])]);

        assert.strictEqual((ownerBalanceAfter - ownerBalanceBefore).toString(), contractBalanceBefore, "Owner balance mismatch");
        assert.strictEqual(contractBalanceAfter, '0', "Contract balance mismatch");
    });

    it("Payable function should not be called from a contract", async () => {
        const dcontract = await DummyContract.new();
        await dcontract.sendTransaction({value: value.toString()});

        return handleErrorTransaction(() => dcontract.testCall.sendTransaction(contract.address));
    });
});
