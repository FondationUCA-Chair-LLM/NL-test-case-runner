# NL-test-case-runner
Test runners for executing NL test cases written in natural language with LLM agents

3 prototype tools composed of three LLM agents for executing NL test cases. These tools explore the execution of functional test cases written in natural language (NL) using LLM-based agents with guardrails to preserve soundness as far as possible.  
See paper available here : ****
- Two agents focus on evaluating readiness actions (checks that the GUI is ready for the next test step) and assertions.  
- The third agent is built on top of the [Stagehand](https://www.stagehand.dev/) framework, which automates browser interactions in natural language and code using LLMs. Stagehand is used here to perform navigation actions and partial data extraction from Web pages.  

---

## Tools

### 1. Eval-Agent
Eval-Agent is specialised for evaluating the reliability of an LLM agent.  
For a given agent, it computes three standard deviation scores:  

- `σ(agent_readiness)`
- `σ(agent_nav)`  
- `σ(agent_assert)`  

These scores assess the capabilities of the LLM agent across three core tasks: readiness, navigation, and assertion.  

**How it works:**  
- Takes a test suite and runs it `N` times.  
- Computes standard deviations for the three tasks.  

Two test suites are provided in the depot:
- TestG is an initial test suite designed for experimenting 3 web sites (Google Gruyere, UCA, and a personal web site). It includes 16 test cases, each consisting of 4 to 15 steps and 1 to 4 assertions. Each test case is supplemented with a boolean tabular specifying the expected outcome of every step. To broadly evaluate agent capabilities, the test cases include both positive assertions (where a Pass verdict is expected) and negative assertions (where a Fail verdict is expected). This enables the evaluation of our tool and agents under both correct and erroneous steps;

- TestA is a test suite specialised in assessing the capabilities of agents to evaluate assertions on 3 web sites (UCA, ARTEMIS, personal web site). In our initial experiments, we observed that, on occasion, a navigation action deemed successful by the agent was in fact executed incorrectly, subsequently resulting in the failure of an assertion evaluation. Such inconsistencies hamper the accurate assessment of an agent ability in evaluating assertions. To address this issue, we developed the test suite TestA, comprising NL test cases that contain only assertions. It includes 29 NL test cases having one assertion (no navigation step). As previously, a NL test case is associated to a boolean list to indicate whether the expected result of the assertion;  

---

### 2. NLTestRunner
NLTestRunner implements *Algorithm A1* (see paper).  
It is designed to execute NL test cases with guardrails and compute test execution consistency measures by means of the standard deviations computed previously

**Features:**  
- Input: a test suite and the number of runs `N`.  
- Executes NL test cases and returns verdicts (`Pass`, `Fail`, or `Inconclusive`).  
- Produces estimated consistency measures and observed test case execution consistencies (if `N > 0`).  
- Recognizes **12 prompt forms** to perform strict readiness and strict assertion evaluations.  

---

### 3. SimpleNLTestRunner
The same as previously but without guardrails. Soundness is not taken into consideration.

## Requirements
- Python 3.10+  
- Access to an LLM (local or API-based)  
- [Stagehand](https://www.stagehand.dev/) for browser-based interactions, but it 's included in the depot

---

## Installation
Clone the repository and install dependencies: npm install @browserbasehq/stagehand playwright zod
Change the configurations in Stagehand.config.ts
Launch with npm start

## Acknoledgement
Research supported by the industrial chair on Reliable and Confident Use of LLMs (https://uca-fondation.fr/les-chaires/***) and MIAI Cluster, France 2030  (ANR-23-IACL-0006)
<img width="2183" height="60" alt="image" src="https://github.com/user-attachments/assets/c8f14976-5571-4ab1-8947-714d5e293fd4" />

