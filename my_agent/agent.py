from typing import TypedDict, Literal

from langgraph.graph import StateGraph, START, END
from my_agent.utils.nodes import call_model, should_continue, tool_node
from my_agent.utils.state import AgentState

from pydantic import BaseModel

# The overall state of the graph (this is the public state shared across nodes)
class OverallState(BaseModel):
    messages: str


def node(state: OverallState):
    return {"messages": state.messages}

# Define the config
class GraphConfig2(BaseModel):
    model_name: Literal["anthropic", "openai"]

# Build the state graph
builder = StateGraph(OverallState, config_schema=GraphConfig2)
builder.add_node("node",node)  # node_1 is the first node
builder.add_edge(START, "node")  # Start the graph with node_1
builder.add_edge("node", END)  # End the graph after node_1
graph = builder.compile()

# Test the graph with a valid input
graph.invoke({"messages": "hello"})

# # Define the config
# class GraphConfig(TypedDict):
#     model_name: Literal["anthropic", "openai"]


# # Define a new graph
# workflow = StateGraph(AgentState, config_schema=GraphConfig)

# # Define the two nodes we will cycle between
# workflow.add_node("agent", call_model)
# workflow.add_node("action", tool_node)

# # Set the entrypoint as `agent`
# # This means that this node is the first one called
# workflow.set_entry_point("agent")

# # We now add a conditional edge
# workflow.add_conditional_edges(
#     # First, we define the start node. We use `agent`.
#     # This means these are the edges taken after the `agent` node is called.
#     "agent",
#     # Next, we pass in the function that will determine which node is called next.
#     should_continue,
#     # Finally we pass in a mapping.
#     # The keys are strings, and the values are other nodes.
#     # END is a special node marking that the graph should finish.
#     # What will happen is we will call `should_continue`, and then the output of that
#     # will be matched against the keys in this mapping.
#     # Based on which one it matches, that node will then be called.
#     {
#         # If `tools`, then we call the tool node.
#         "continue": "action",
#         # Otherwise we finish.
#         "end": END,
#     },
# )

# # We now add a normal edge from `tools` to `agent`.
# # This means that after `tools` is called, `agent` node is called next.
# workflow.add_edge("action", "agent")

# # Finally, we compile it!
# # This compiles it into a LangChain Runnable,
# # meaning you can use it as you would any other runnable
# graph = workflow.compile()
